import { describe, it, expect, beforeEach } from "vitest";
import { uintCV, intCV, principalCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_VOTING_CLOSED = 101;
const ERR_INVALID_PROPOSAL = 102;
const ERR_ALREADY_VOTED = 103;
const ERR_INSUFFICIENT_BALANCE = 104;
const ERR_INVALID_VOTE_AMOUNT = 105;
const ERR_VOTING_NOT_ACTIVE = 106;
const ERR_PROPOSAL_ENDED = 107;
const ERR_PROPOSAL_NOT_FOUND = 108;
const ERR_INVALID_END_TIME = 109;
const ERR_NOT_PROPOSAL_OWNER = 110;
const ERR_VOTE_CHANGE_NOT_ALLOWED = 111;
const ERR_INVALID_QUADRATIC_COST = 112;
const ERR_MAX_VOTES_EXCEEDED = 113;
const ERR_INVALID_STATUS = 114;
const ERR_TALLY_FAILED = 115;
const ERR_LOCKED_TOKENS = 116;
const ERR_UNLOCK_FAILED = 117;
const ERR_INVALID_PARAM = 118;
const ERR_AUTHORITY_NOT_SET = 119;
const ERR_INVALID_THRESHOLD = 120;

interface Proposal {
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  voteCount: number;
  status: number;
  owner: string;
  startTime: number;
  endTime: number;
}

interface UserVote {
  votes: number;
  lockedTokens: number;
}

interface LockedTokens {
  amount: number;
  unlockTime: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class VotingMechanismMock {
  state: {
    votingActive: boolean;
    votingStartTime: number;
    votingEndTime: number;
    quadraticCostFactor: number;
    maxVotePerUser: number;
    minVoteThreshold: number;
    authorityPrincipal: string;
    proposals: Map<number, Proposal>;
    userVotes: Map<string, UserVote>;
    lockedTokens: Map<string, LockedTokens>;
  } = {
    votingActive: false,
    votingStartTime: 0,
    votingEndTime: 0,
    quadraticCostFactor: 1,
    maxVotePerUser: 1000,
    minVoteThreshold: 10,
    authorityPrincipal: "ST1TEST",
    proposals: new Map(),
    userVotes: new Map(),
    lockedTokens: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  tokenBalances: Map<string, number> = new Map([["ST1TEST", 10000]]);
  transfers: Array<{ amount: number; from: string; to: string }> = [];
  locks: Array<{ amount: number; user: string; unlockTime: number }> = [];
  unlocks: Array<{ amount: number; user: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      votingActive: false,
      votingStartTime: 0,
      votingEndTime: 0,
      quadraticCostFactor: 1,
      maxVotePerUser: 1000,
      minVoteThreshold: 10,
      authorityPrincipal: "ST1TEST",
      proposals: new Map(),
      userVotes: new Map(),
      lockedTokens: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.tokenBalances = new Map([["ST1TEST", 10000]]);
    this.transfers = [];
    this.locks = [];
    this.unlocks = [];
  }

  getProposal(proposalId: number): Proposal | undefined {
    return this.state.proposals.get(proposalId);
  }

  getUserVote(user: string, proposalId: number): UserVote | undefined {
    return this.state.userVotes.get(`${user}-${proposalId}`);
  }

  getLockedTokens(user: string): LockedTokens | undefined {
    return this.state.lockedTokens.get(user);
  }

  isVotingActive(): boolean {
    return this.state.votingActive;
  }

  getVotingTimes(): { start: number; end: number } {
    return { start: this.state.votingStartTime, end: this.state.votingEndTime };
  }

  setAuthority(newAuthority: string): Result<boolean> {
    if (this.caller !== this.state.authorityPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.authorityPrincipal = newAuthority;
    return { ok: true, value: true };
  }

  setQuadraticFactor(newFactor: number): Result<boolean> {
    if (this.caller !== this.state.authorityPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newFactor <= 0) return { ok: false, value: ERR_INVALID_PARAM };
    this.state.quadraticCostFactor = newFactor;
    return { ok: true, value: true };
  }

  setMaxVotePerUser(newMax: number): Result<boolean> {
    if (this.caller !== this.state.authorityPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMax <= 0) return { ok: false, value: ERR_INVALID_PARAM };
    this.state.maxVotePerUser = newMax;
    return { ok: true, value: true };
  }

  setMinThreshold(newMin: number): Result<boolean> {
    if (this.caller !== this.state.authorityPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMin <= 0) return { ok: false, value: ERR_INVALID_PARAM };
    this.state.minVoteThreshold = newMin;
    return { ok: true, value: true };
  }

  startVotingPeriod(start: number, end: number): Result<boolean> {
    if (this.caller !== this.state.authorityPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.votingActive) return { ok: false, value: ERR_VOTING_CLOSED };
    if (end <= start || start < this.blockHeight) return { ok: false, value: ERR_INVALID_END_TIME };
    this.state.votingActive = true;
    this.state.votingStartTime = start;
    this.state.votingEndTime = end;
    return { ok: true, value: true };
  }

  endVotingPeriod(): Result<boolean> {
    if (this.caller !== this.state.authorityPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!this.state.votingActive) return { ok: false, value: ERR_VOTING_NOT_ACTIVE };
    this.state.votingActive = false;
    return { ok: true, value: true };
  }

  createProposal(proposalId: number, endTime: number): Result<boolean> {
    if (!this.state.votingActive) return { ok: false, value: ERR_VOTING_NOT_ACTIVE };
    if (this.state.proposals.has(proposalId)) return { ok: false, value: ERR_INVALID_PROPOSAL };
    if (endTime <= this.blockHeight) return { ok: false, value: ERR_INVALID_END_TIME };
    this.state.proposals.set(proposalId, {
      totalVotes: 0,
      yesVotes: 0,
      noVotes: 0,
      voteCount: 0,
      status: 0,
      owner: this.caller,
      startTime: this.blockHeight,
      endTime,
    });
    return { ok: true, value: true };
  }

  castVote(proposalId: number, votes: number): Result<boolean> {
    const proposal = this.state.proposals.get(proposalId);
    if (!proposal) return { ok: false, value: ERR_PROPOSAL_NOT_FOUND };
    if (!this.state.votingActive || this.blockHeight < this.state.votingStartTime || this.blockHeight > this.state.votingEndTime) {
      return { ok: false, value: ERR_VOTING_NOT_ACTIVE };
    }
    if (this.blockHeight >= proposal.endTime) return { ok: false, value: ERR_PROPOSAL_ENDED };
    if (proposal.status !== 0) return { ok: false, value: ERR_INVALID_STATUS };
    const key = `${this.caller}-${proposalId}`;
    if (this.state.userVotes.has(key)) return { ok: false, value: ERR_ALREADY_VOTED };
    const absVotes = Math.abs(votes);
    if (absVotes === 0 || absVotes > this.state.maxVotePerUser) return { ok: false, value: ERR_INVALID_VOTE_AMOUNT };
    const cost = this.state.quadraticCostFactor * (absVotes ** 2);
    const balance = this.tokenBalances.get(this.caller) || 0;
    if (balance < cost) return { ok: false, value: ERR_INSUFFICIENT_BALANCE };
    this.tokenBalances.set(this.caller, balance - cost);
    this.transfers.push({ amount: cost, from: this.caller, to: "contract" });
    this.locks.push({ amount: cost, user: this.caller, unlockTime: proposal.endTime });
    const currentLocked = this.state.lockedTokens.get(this.caller) || { amount: 0, unlockTime: 0 };
    this.state.lockedTokens.set(this.caller, { amount: currentLocked.amount + cost, unlockTime: proposal.endTime });
    this.state.userVotes.set(key, { votes, lockedTokens: cost });
    proposal.totalVotes += absVotes;
    proposal.voteCount += 1;
    if (votes > 0) proposal.yesVotes += absVotes;
    else proposal.noVotes += absVotes;
    return { ok: true, value: true };
  }

  changeVote(proposalId: number, newVotes: number): Result<boolean> {
    return { ok: false, value: ERR_VOTE_CHANGE_NOT_ALLOWED };
  }

  tallyVotes(proposalId: number): Result<boolean> {
    const proposal = this.state.proposals.get(proposalId);
    if (!proposal) return { ok: false, value: ERR_PROPOSAL_NOT_FOUND };
    if (this.blockHeight < proposal.endTime) return { ok: false, value: ERR_PROPOSAL_ENDED };
    if (proposal.status !== 0) return { ok: false, value: ERR_INVALID_STATUS };
    const passed = proposal.totalVotes >= this.state.minVoteThreshold && proposal.yesVotes > proposal.noVotes;
    proposal.status = passed ? 1 : 2;
    return { ok: true, value: passed };
  }

  withdrawLockedTokens(): Result<boolean> {
    const locked = this.state.lockedTokens.get(this.caller);
    if (!locked) return { ok: false, value: ERR_UNLOCK_FAILED };
    if (this.blockHeight < locked.unlockTime) return { ok: false, value: ERR_LOCKED_TOKENS };
    this.unlocks.push({ amount: locked.amount, user: this.caller });
    this.state.lockedTokens.delete(this.caller);
    return { ok: true, value: true };
  }

  executeProposal(proposalId: number): Result<boolean> {
    const proposal = this.state.proposals.get(proposalId);
    if (!proposal) return { ok: false, value: ERR_PROPOSAL_NOT_FOUND };
    if (this.caller !== proposal.owner) return { ok: false, value: ERR_NOT_PROPOSAL_OWNER };
    if (proposal.status !== 1) return { ok: false, value: ERR_INVALID_STATUS };
    proposal.status = 3;
    return { ok: true, value: true };
  }
}

describe("VotingMechanism", () => {
  let contract: VotingMechanismMock;

  beforeEach(() => {
    contract = new VotingMechanismMock();
    contract.reset();
  });

  it("starts voting period successfully", () => {
    contract.blockHeight = 10;
    const result = contract.startVotingPeriod(11, 20);
    expect(result.ok).toBe(true);
    expect(contract.isVotingActive()).toBe(true);
    expect(contract.getVotingTimes()).toEqual({ start: 11, end: 20 });
  });

  it("rejects starting voting if already active", () => {
    contract.startVotingPeriod(1, 10);
    const result = contract.startVotingPeriod(11, 20);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_VOTING_CLOSED);
  });

  it("ends voting period successfully", () => {
    contract.startVotingPeriod(1, 10);
    const result = contract.endVotingPeriod();
    expect(result.ok).toBe(true);
    expect(contract.isVotingActive()).toBe(false);
  });

  it("creates proposal successfully", () => {
    contract.startVotingPeriod(1, 10);
    contract.blockHeight = 2;
    const result = contract.createProposal(1, 9);
    expect(result.ok).toBe(true);
    const proposal = contract.getProposal(1);
    expect(proposal?.endTime).toBe(9);
    expect(proposal?.owner).toBe("ST1TEST");
  });

  it("rejects proposal creation if voting not active", () => {
    const result = contract.createProposal(1, 10);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_VOTING_NOT_ACTIVE);
  });

  it("casts vote successfully", () => {
    contract.startVotingPeriod(1, 10);
    contract.blockHeight = 2;
    contract.createProposal(1, 9);
    const result = contract.castVote(1, 5);
    expect(result.ok).toBe(true);
    const proposal = contract.getProposal(1);
    expect(proposal?.yesVotes).toBe(5);
    expect(proposal?.totalVotes).toBe(5);
    const vote = contract.getUserVote("ST1TEST", 1);
    expect(vote?.votes).toBe(5);
    expect(contract.tokenBalances.get("ST1TEST")).toBe(10000 - 25);
  });

  it("rejects vote if already voted", () => {
    contract.startVotingPeriod(1, 10);
    contract.blockHeight = 2;
    contract.createProposal(1, 9);
    contract.castVote(1, 5);
    const result = contract.castVote(1, 3);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ALREADY_VOTED);
  });

  it("rejects vote if insufficient balance", () => {
    contract.startVotingPeriod(1, 10);
    contract.blockHeight = 2;
    contract.createProposal(1, 9);
    contract.tokenBalances.set("ST1TEST", 10);
    const result = contract.castVote(1, 5);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INSUFFICIENT_BALANCE);
  });

  it("rejects tally if proposal not ended", () => {
    contract.startVotingPeriod(1, 10);
    contract.blockHeight = 2;
    contract.createProposal(1, 5);
    const result = contract.tallyVotes(1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PROPOSAL_ENDED);
  });

  it("withdraws locked tokens successfully", () => {
    contract.startVotingPeriod(1, 10);
    contract.blockHeight = 2;
    contract.createProposal(1, 5);
    contract.castVote(1, 5);
    contract.blockHeight = 6;
    const result = contract.withdrawLockedTokens();
    expect(result.ok).toBe(true);
    expect(contract.getLockedTokens("ST1TEST")).toBeUndefined();
  });

  it("rejects withdraw if tokens locked", () => {
    contract.startVotingPeriod(1, 10);
    contract.blockHeight = 2;
    contract.createProposal(1, 5);
    contract.castVote(1, 5);
    const result = contract.withdrawLockedTokens();
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_LOCKED_TOKENS);
  });

  it("rejects execute if not owner", () => {
    contract.startVotingPeriod(1, 10);
    contract.blockHeight = 2;
    contract.createProposal(1, 5);
    contract.castVote(1, 5);
    contract.blockHeight = 6;
    contract.tallyVotes(1);
    contract.caller = "ST2FAKE";
    const result = contract.executeProposal(1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_PROPOSAL_OWNER);
  });

  it("sets quadratic factor successfully", () => {
    const result = contract.setQuadraticFactor(2);
    expect(result.ok).toBe(true);
    expect(contract.state.quadraticCostFactor).toBe(2);
  });

  it("rejects invalid quadratic factor", () => {
    const result = contract.setQuadraticFactor(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PARAM);
  });

  it("casts negative vote successfully", () => {
    contract.startVotingPeriod(1, 10);
    contract.blockHeight = 2;
    contract.createProposal(1, 9);
    const result = contract.castVote(1, -5);
    expect(result.ok).toBe(true);
    const proposal = contract.getProposal(1);
    expect(proposal?.noVotes).toBe(5);
    expect(proposal?.totalVotes).toBe(5);
  });

  it("tallies failing proposal", () => {
    contract.startVotingPeriod(1, 10);
    contract.blockHeight = 2;
    contract.createProposal(1, 5);
    contract.castVote(1, -5);
    contract.blockHeight = 6;
    const result = contract.tallyVotes(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(false);
    const proposal = contract.getProposal(1);
    expect(proposal?.status).toBe(2);
  });

  it("rejects vote exceeding max per user", () => {
    contract.startVotingPeriod(1, 10);
    contract.blockHeight = 2;
    contract.createProposal(1, 9);
    const result = contract.castVote(1, 1001);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_VOTE_AMOUNT);
  });

  it("rejects change vote", () => {
    contract.startVotingPeriod(1, 10);
    contract.blockHeight = 2;
    contract.createProposal(1, 9);
    contract.castVote(1, 5);
    const result = contract.changeVote(1, 3);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_VOTE_CHANGE_NOT_ALLOWED);
  });
});