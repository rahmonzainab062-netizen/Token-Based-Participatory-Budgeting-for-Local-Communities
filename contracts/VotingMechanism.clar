(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-VOTING-CLOSED u101)
(define-constant ERR-INVALID-PROPOSAL u102)
(define-constant ERR-ALREADY-VOTED u103)
(define-constant ERR-INSUFFICIENT-BALANCE u104)
(define-constant ERR-INVALID-VOTE-AMOUNT u105)
(define-constant ERR-VOTING-NOT-ACTIVE u106)
(define-constant ERR-PROPOSAL-ENDED u107)
(define-constant ERR-PROPOSAL-NOT-FOUND u108)
(define-constant ERR-INVALID-END-TIME u109)
(define-constant ERR-NOT-PROPOSAL-OWNER u110)
(define-constant ERR-VOTE-CHANGE-NOT-ALLOWED u111)
(define-constant ERR-INVALID-QUADRATIC-COST u112)
(define-constant ERR-MAX-VOTES-EXCEEDED u113)
(define-constant ERR-INVALID-STATUS u114)
(define-constant ERR-TALLY-FAILED u115)
(define-constant ERR-LOCKED-TOKENS u116)
(define-constant ERR-UNLOCK-FAILED u117)
(define-constant ERR-INVALID-PARAM u118)
(define-constant ERR-AUTHORITY-NOT-SET u119)
(define-constant ERR-INVALID-THRESHOLD u120)

(define-data-var voting-active bool false)
(define-data-var voting-start-time uint u0)
(define-data-var voting-end-time uint u0)
(define-data-var quadratic-cost-factor uint u1)
(define-data-var max-vote-per-user uint u1000)
(define-data-var min-vote-threshold uint u10)
(define-data-var authority-principal principal tx-sender)

(define-map Proposals
  { proposal-id: uint }
  {
    total-votes: uint,
    yes-votes: uint,
    no-votes: uint,
    vote-count: uint,
    status: uint,
    owner: principal,
    start-time: uint,
    end-time: uint
  }
)

(define-map UserVotes
  { user: principal, proposal-id: uint }
  { votes: int, locked-tokens: uint }
)

(define-map LockedTokens
  { user: principal }
  { amount: uint, unlock-time: uint }
)

(define-trait governance-token-trait
  (
    (get-balance (principal) (response uint uint))
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (lock-tokens (uint uint) (response bool uint))
    (unlock-tokens (uint) (response bool uint))
  )
)

(define-read-only (get-proposal (proposal-id uint))
  (map-get? Proposals { proposal-id: proposal-id })
)

(define-read-only (get-user-vote (user principal) (proposal-id uint))
  (map-get? UserVotes { user: user, proposal-id: proposal-id })
)

(define-read-only (get-locked-tokens (user principal))
  (map-get? LockedTokens { user: user })
)

(define-read-only (is-voting-active)
  (var-get voting-active)
)

(define-read-only (get-voting-times)
  { start: (var-get voting-start-time), end: (var-get voting-end-time) }
)

(define-private (is-authorized (caller principal))
  (is-eq caller (var-get authority-principal))
)

(define-private (validate-vote-amount (amount uint))
  (if (and (> amount u0) (<= amount (var-get max-vote-per-user)))
    (ok true)
    (err ERR-INVALID-VOTE-AMOUNT))
)

(define-private (validate-proposal-id (id uint))
  (if (is-some (map-get? Proposals { proposal-id: id }))
    (ok true)
    (err ERR-INVALID-PROPOSAL))
)

(define-private (calculate-quadratic-cost (votes int))
  (let ((abs-votes (if (< votes 0) (* votes -1) votes)))
    (* (var-get quadratic-cost-factor) (pow (to-uint abs-votes) u2))
  )
)

(define-private (check-voting-period)
  (let ((current-time block-height))
    (if (and (var-get voting-active) (>= current-time (var-get voting-start-time)) (<= current-time (var-get voting-end-time)))
      (ok true)
      (err ERR-VOTING-NOT-ACTIVE))
  )
)

(define-private (lock-tokens (user principal) (amount uint) (unlock-time uint))
  (let ((token-contract (as-contract (contract-call? .GovernanceToken)))
        (current-locked (default-to { amount: u0, unlock-time: u0 } (map-get? LockedTokens { user: user }))))
    (try! (contract-call? token-contract lock-tokens amount unlock-time))
    (map-set LockedTokens { user: user } { amount: (+ (get amount current-locked) amount), unlock-time: unlock-time })
    (ok true)
  )
)

(define-private (unlock-tokens (user principal) (amount uint))
  (let ((token-contract (as-contract (contract-call? .GovernanceToken)))
        (current-locked (unwrap! (map-get? LockedTokens { user: user }) (err ERR-UNLOCK-FAILED))))
    (asserts! (>= (get amount current-locked) amount) (err ERR-INSUFFICIENT-BALANCE))
    (try! (contract-call? token-contract unlock-tokens amount))
    (map-set LockedTokens { user: user } { amount: (- (get amount current-locked) amount), unlock-time: (get unlock-time current-locked) })
    (ok true)
  )
)

(define-public (set-authority (new-authority principal))
  (begin
    (asserts! (is-authorized tx-sender) (err ERR-NOT-AUTHORIZED))
    (var-set authority-principal new-authority)
    (ok true)
  )
)

(define-public (set-quadratic-factor (new-factor uint))
  (begin
    (asserts! (is-authorized tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-factor u0) (err ERR-INVALID-PARAM))
    (var-set quadratic-cost-factor new-factor)
    (ok true)
  )
)

(define-public (set-max-vote-per-user (new-max uint))
  (begin
    (asserts! (is-authorized tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-max u0) (err ERR-INVALID-PARAM))
    (var-set max-vote-per-user new-max)
    (ok true)
  )
)

(define-public (set-min-threshold (new-min uint))
  (begin
    (asserts! (is-authorized tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-min u0) (err ERR-INVALID-PARAM))
    (var-set min-vote-threshold new-min)
    (ok true)
  )
)

(define-public (start-voting-period (start uint) (end uint))
  (begin
    (asserts! (is-authorized tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (var-get voting-active)) (err ERR-VOTING-CLOSED))
    (asserts! (> end start) (err ERR-INVALID-END-TIME))
    (asserts! (>= start block-height) (err ERR-INVALID-END-TIME))
    (var-set voting-active true)
    (var-set voting-start-time start)
    (var-set voting-end-time end)
    (print { event: "voting-started", start: start, end: end })
    (ok true)
  )
)

(define-public (end-voting-period)
  (begin
    (asserts! (is-authorized tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (var-get voting-active) (err ERR-VOTING-NOT-ACTIVE))
    (var-set voting-active false)
    (print { event: "voting-ended" })
    (ok true)
  )
)

(define-public (create-proposal (proposal-id uint) (end-time uint))
  (let ((caller tx-sender)
        (current-time block-height))
    (asserts! (var-get voting-active) (err ERR-VOTING-NOT-ACTIVE))
    (asserts! (is-none (map-get? Proposals { proposal-id: proposal-id })) (err ERR-INVALID-PROPOSAL))
    (asserts! (> end-time current-time) (err ERR-INVALID-END-TIME))
    (map-set Proposals { proposal-id: proposal-id }
      {
        total-votes: u0,
        yes-votes: u0,
        no-votes: u0,
        vote-count: u0,
        status: u0,
        owner: caller,
        start-time: current-time,
        end-time: end-time
      }
    )
    (print { event: "proposal-created", id: proposal-id })
    (ok true)
  )
)

(define-public (cast-vote (proposal-id uint) (votes int))
  (let ((caller tx-sender)
        (proposal (unwrap! (map-get? Proposals { proposal-id: proposal-id }) (err ERR-PROPOSAL-NOT-FOUND)))
        (current-vote (default-to { votes: 0, locked-tokens: u0 } (map-get? UserVotes { user: caller, proposal-id: proposal-id })))
        (token-balance (unwrap! (contract-call? .GovernanceToken get-balance caller) (err ERR-INSUFFICIENT-BALANCE)))
        (cost (calculate-quadratic-cost votes))
        (abs-votes (if (< votes 0) (* votes -1) votes)))
    (try! (check-voting-period))
    (asserts! (> (get end-time proposal) block-height) (err ERR-PROPOSAL-ENDED))
    (asserts! (is-eq (get status proposal) u0) (err ERR-INVALID-STATUS))
    (asserts! (is-none (map-get? UserVotes { user: caller, proposal-id: proposal-id })) (err ERR-ALREADY-VOTED))
    (asserts! (>= token-balance cost) (err ERR-INSUFFICIENT-BALANCE))
    (asserts! (<= (to-uint abs-votes) (var-get max-vote-per-user)) (err ERR-MAX-VOTES-EXCEEDED))
    (try! (contract-call? .GovernanceToken transfer cost caller (as-contract tx-sender) none))
    (try! (lock-tokens caller cost (get end-time proposal)))
    (map-set UserVotes { user: caller, proposal-id: proposal-id } { votes: votes, locked-tokens: cost })
    (map-set Proposals { proposal-id: proposal-id }
      {
        total-votes: (+ (get total-votes proposal) (to-uint abs-votes)),
        yes-votes: (if (> votes 0) (+ (get yes-votes proposal) (to-uint abs-votes)) (get yes-votes proposal)),
        no-votes: (if (< votes 0) (+ (get no-votes proposal) (to-uint abs-votes)) (get no-votes proposal)),
        vote-count: (+ (get vote-count proposal) u1),
        status: (get status proposal),
        owner: (get owner proposal),
        start-time: (get start-time proposal),
        end-time: (get end-time proposal)
      }
    )
    (print { event: "vote-cast", proposal-id: proposal-id, votes: votes, voter: caller })
    (ok true)
  )
)

(define-public (change-vote (proposal-id uint) (new-votes int))
  (let ((caller tx-sender)
        (proposal (unwrap! (map-get? Proposals { proposal-id: proposal-id }) (err ERR-PROPOSAL-NOT-FOUND)))
        (current-vote (unwrap! (map-get? UserVotes { user: caller, proposal-id: proposal-id }) (err ERR-ALREADY-VOTED)))
        (new-cost (calculate-quadratic-cost new-votes))
        (current-cost (get locked-tokens current-vote))
        (abs-new (if (< new-votes 0) (* new-votes -1) new-votes))
        (abs-current (if (< (get votes current-vote) 0) (* (get votes current-vote) -1) (get votes current-vote))))
    (try! (check-voting-period))
    (asserts! (> (get end-time proposal) block-height) (err ERR-PROPOSAL-ENDED))
    (asserts! (is-eq (get status proposal) u0) (err ERR-INVALID-STATUS))
    (asserts! false (err ERR-VOTE-CHANGE-NOT-ALLOWED))
    (ok true)
  )
)

(define-public (tally-votes (proposal-id uint))
  (let ((proposal (unwrap! (map-get? Proposals { proposal-id: proposal-id }) (err ERR-PROPOSAL-NOT-FOUND))))
    (asserts! (>= block-height (get end-time proposal)) (err ERR-PROPOSAL-ENDED))
    (asserts! (is-eq (get status proposal) u0) (err ERR-INVALID-STATUS))
    (let ((passed (and (>= (get total-votes proposal) (var-get min-vote-threshold))
                      (> (get yes-votes proposal) (get no-votes proposal)))))
      (map-set Proposals { proposal-id: proposal-id }
        (merge proposal { status: (if passed u1 u2) })
      )
      (print { event: "votes-tallied", proposal-id: proposal-id, passed: passed })
      (ok passed)
    )
  )
)

(define-public (withdraw-locked-tokens)
  (let ((caller tx-sender)
        (locked (unwrap! (map-get? LockedTokens { user: caller }) (err ERR-UNLOCK-FAILED))))
    (asserts! (>= block-height (get unlock-time locked)) (err ERR-LOCKED-TOKENS))
    (try! (unlock-tokens caller (get amount locked)))
    (map-delete LockedTokens { user: caller })
    (ok true)
  )
)

(define-public (execute-proposal (proposal-id uint))
  (let ((proposal (unwrap! (map-get? Proposals { proposal-id: proposal-id }) (err ERR-PROPOSAL-NOT-FOUND))))
    (asserts! (is-eq tx-sender (get owner proposal)) (err ERR-NOT-PROPOSAL-OWNER))
    (asserts! (is-eq (get status proposal) u1) (err ERR-INVALID-STATUS))
    (map-set Proposals { proposal-id: proposal-id }
      (merge proposal { status: u3 })
    )
    (try! (contract-call? .ExecutionEngine start-execution proposal-id))
    (print { event: "proposal-executed", id: proposal-id })
    (ok true)
  )
)