# 🗳️ Token-Based Participatory Budgeting for Local Communities

Welcome to a decentralized solution for empowering local communities to democratically allocate shared funds! This Web3 project uses the Stacks blockchain and Clarity smart contracts to enable transparent, token-based participatory budgeting. It solves the real-world problem of opaque government spending and lack of community involvement in local decision-making, reducing corruption and increasing trust through immutable on-chain voting and fund distribution.

## ✨ Features

🪙 Governance tokens for community members to vote on proposals  
📝 Submit and manage budget proposals with clear descriptions and funding requests  
🗳️ Token-weighted voting system for fair participation  
💰 Secure treasury for holding and disbursing community funds  
🔍 Transparent audit trails for all transactions and decisions  
🏆 Reward mechanisms for active participants  
🚫 Anti-collusion measures to prevent vote manipulation  
📊 Analytics for proposal success rates and fund usage  

## 🛠 How It Works

This project is built with 8 modular Clarity smart contracts to handle different aspects of the participatory budgeting process. Each contract is designed for security, composability, and scalability on the Stacks network. Below is an overview of the contracts and their roles.

### Core Smart Contracts

1. **GovernanceToken.clar** (SIP-10 Fungible Token)  
   - Manages the issuance, transfer, and balance of governance tokens (e.g., COMM-TOKEN).  
   - Community members stake or earn tokens to gain voting power.  
   - Functions: `mint-tokens`, `transfer`, `get-balance`.  

2. **MembershipRegistry.clar**  
   - Registers verified community members (e.g., via STX address or off-chain KYC integration).  
   - Tracks eligibility for token claims and voting.  
   - Functions: `register-member`, `verify-membership`, `revoke-access`.  

3. **ProposalFactory.clar**  
   - Allows members to create new budget proposals with details like title, description, requested amount, and timeline.  
   - Ensures proposals meet minimum requirements (e.g., token stake for submission).  
   - Functions: `create-proposal`, `get-proposal-details`, `validate-proposal`.  

4. **VotingMechanism.clar**  
   - Handles token-weighted voting on active proposals.  
   - Supports quadratic voting to amplify smaller voices and prevent whale dominance.  
   - Functions: `cast-vote`, `tally-votes`, `end-voting-period`.  

5. **TreasuryVault.clar**  
   - Securely holds community funds (STX or wrapped BTC) in a multi-sig-like setup.  
   - Releases funds only to winning proposals after voting concludes.  
   - Functions: `deposit-funds`, `execute-payout`, `get-treasury-balance`.  

6. **ExecutionEngine.clar**  
   - Manages the post-voting execution of approved proposals, including milestone tracking.  
   - Allows proposers to submit progress reports for phased fund releases.  
   - Functions: `start-execution`, `submit-milestone`, `release-funds`.  

7. **RewardDistributor.clar**  
   - Distributes rewards (e.g., bonus tokens) to active voters and successful proposers.  
   - Encourages participation by incentivizing engagement.  
   - Functions: `claim-reward`, `distribute-rewards`, `calculate-reward`.  

8. **AuditLogger.clar**  
   - Logs all key events (proposals, votes, payouts) immutably for transparency.  
   - Provides query functions for external audits or dashboards.  
   - Functions: `log-event`, `query-logs`, `generate-report`.  

**For Community Members**  
- Claim or buy governance tokens via `GovernanceToken.clar`.  
- Register as a member using `MembershipRegistry.clar`.  
- Submit a proposal with `ProposalFactory.clar` (e.g., "Fund a new community park: 5000 STX requested").  
- Vote on proposals during the active period with `VotingMechanism.clar`.  

**For Administrators/Verifiers**  
- Monitor treasury with `TreasuryVault.clar`.  
- Track execution and release funds via `ExecutionEngine.clar`.  
- Audit the process using `AuditLogger.clar` for full transparency.  

Once deployed, the system runs autonomously on Stacks, with Bitcoin-secured finality. Integrate with a frontend dApp for easy interaction—users connect their Hiro Wallet, submit proposals, and vote seamlessly.

## 🚀 Getting Started

1. Install the Clarinet SDK for Clarity development.  
2. Deploy the contracts to Stacks testnet using `clarinet deploy`.  
3. Test end-to-end: Mint tokens, create a proposal, vote, and execute a payout.  
4. Build a UI with React and @stacks/connect for real-world use.

This project promotes inclusive democracy, ensuring every token holder's voice counts in local budgeting! If you're building this, let's collaborate on decentralizing community governance. 🌍