#![no_std]

//! # MilestoneArbitration
//!
//! On-chain, staked-juror commit-reveal arbitration for disputed milestone
//! rejections. A rejected scholar escalates to a panel of LRN-staking jurors
//! instead of a single off-chain admin; the panel votes blind (commit, then
//! reveal), the majority outcome is the source of truth [`milestone_escrow`]
//! can rely on for [`milestone_escrow::MilestoneEscrow::release_tranche`]-style
//! disbursement, and jurors who vote against the outcome — or never reveal at
//! all — are slashed.
//!
//! ## Lifecycle
//!
//! 1. [`MilestoneArbitration::join_panel`] — a would-be juror stakes LRN and
//!    joins the eligible pool. Anyone in the pool can be drawn onto a panel.
//! 2. [`MilestoneArbitration::open_dispute`] — the scholar stakes
//!    [`SCHOLAR_DISPUTE_STAKE`] and opens a dispute. A panel of
//!    [`PANEL_SIZE`] jurors is drawn immediately, weighted by stake and seeded
//!    from ledger data the caller does not control. This starts the commit
//!    window.
//! 3. [`MilestoneArbitration::commit_vote`] — each panel member submits
//!    `sha256(dispute_id ++ vote_byte ++ salt)` before `commit_deadline`.
//! 4. [`MilestoneArbitration::reveal_vote`] — after `commit_deadline` and
//!    before `reveal_deadline`, each committed juror reveals `(vote, salt)`;
//!    the contract recomputes the hash and rejects (does not silently drop) a
//!    mismatched reveal.
//! 5. [`MilestoneArbitration::resolve`] — callable by anyone once every panel
//!    member has revealed, or once `reveal_deadline` has passed. Tallies the
//!    revealed votes, slashes the minority and every non-revealer, and
//!    redistributes their stake to the majority and the winning party.
//!
//! ## Policy parameters
//!
//! [`PANEL_SIZE`] = 5, [`QUORUM`] = 3 (strict majority of the panel). Ties
//! among revealed votes favor the status quo (rejection upheld, nothing
//! moves) rather than releasing funds on an inconclusive result.
//!
//! [`SCHOLAR_DISPUTE_STAKE`] and [`MIN_JUROR_STAKE`] are both denominated in
//! LRN's 7-decimal base units, matching every other LRN-denominated contract
//! in this workspace (`learn_token`, `governance_token`, `lrn_staking`).
//!
//! ### Quorum-failure fallback
//!
//! If fewer than [`QUORUM`] jurors reveal by `reveal_deadline`, the dispute
//! resolves with `outcome = None`: the rejection stands (no escrow release is
//! ever authorized for a `None` outcome — see
//! [`MilestoneArbitration::get_release_outcome`]), the scholar's stake is
//! refunded in full (a quorum failure is the panel's fault, not theirs),
//! jurors who *did* reveal keep their stake untouched, and every juror who
//! never revealed is slashed [`NON_PARTICIPATION_SLASH_BPS`] to the treasury.
//! A dispute can never hang forever: `resolve` is callable by anyone the
//! moment `reveal_deadline` passes, regardless of participation.
//!
//! ### Why a whale can't dominate a panel
//!
//! Selection weight per juror is capped at [`MAX_JUROR_SELECTION_WEIGHT`]
//! LRN, so staking beyond that buys no further odds. Selection is also
//! without replacement — a single address can only occupy one of the
//! [`PANEL_SIZE`] seats on a given dispute, so buying more stake raises the
//! *chance* of being drawn but never the number of seats a whale can hold on
//! one panel. Combined with a five-member panel and a three-vote quorum, a
//! whale would need to simultaneously win multiple independent weighted draws
//! to control an outcome, and each draw is reseeded per dispute from ledger
//! data unavailable to the caller ahead of the transaction (see
//! [`MilestoneArbitration::open_dispute`]'s use of the ledger sequence and
//! timestamp at panel-selection time — not a caller-supplied value).
//!
//! ### Why a scholar can't dispute indefinitely
//!
//! Each rejected milestone can be disputed exactly once
//! ([`DataKey::DisputeByMilestone`] is a one-shot key), disputing costs a real
//! stake that is forfeited outright on a losing outcome, and
//! [`DISPUTE_WINDOW_SECONDS`] bounds how long after rejection a dispute can
//! even be opened. Repeated frivolous disputes across different milestones
//! are self-limiting: every loss is a real, non-recoverable cost.
//!
//! ### A known, documented trust gap
//!
//! The underlying milestone-rejection decision itself is recorded off-chain
//! today (`server/src/controllers/milestone-appeal.controller.ts`); this
//! contract has no on-chain rejection record to check `open_dispute` against.
//! `rejected_at` is therefore a caller-supplied timestamp, bounded only by
//! "not in the future" and "within the dispute window" — it rate-limits
//! staleness, it does not prove a rejection actually happened. Closing this
//! gap fully requires the admin rejection path to publish an on-chain event
//! this contract can verify against, which is out of scope for this change
//! (see the PR description for the full discussion).
//!
//! ## Commit-reveal salting
//!
//! The commitment preimage is `dispute_id (8 bytes, BE) ++ vote_byte (0/1) ++
//! salt (32 bytes)`. It deliberately does not embed the juror's address:
//! storage already partitions each commitment by `(dispute_id, juror)`, so a
//! commitment can never be checked against the wrong juror's reveal. The
//! juror is responsible for generating a fresh random salt per dispute; reuse
//! across disputes risks correlation once the first is revealed, but cannot
//! forge or redirect another juror's vote.
//!
//! ## Evidence
//!
//! `evidence_hash` is a 32-byte hash, not the evidence itself — evidence is
//! pinned to IPFS off-chain (`server/src/services/pinata.service.ts`) and
//! only its hash is ever written on-chain.

use soroban_sdk::{
    Address, Bytes, BytesN, Env, String, Symbol, Vec, contract, contracterror, contractevent,
    contractimpl, contracttype, panic_with_error, symbol_short, token,
};

use learnvault_shared::upgrade;

pub use upgrade::ContractUpgraded;

// ---------------------------------------------------------------------------
// Storage TTL constants (ledger-count convention shared with lrn_staking)
// ---------------------------------------------------------------------------

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const INSTANCE_EXTEND_TO: u32 = DAY_IN_LEDGERS * 30;
const PERSISTENT_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const PERSISTENT_EXTEND_TO: u32 = DAY_IN_LEDGERS * 365;

// ---------------------------------------------------------------------------
// Policy parameters — see the module docs above for the rationale behind
// each of these. All amounts are in LRN base units (7 decimals).
// ---------------------------------------------------------------------------

/// Jurors drawn per dispute. Odd, so a plain majority never ties outright.
pub const PANEL_SIZE: u32 = 5;

/// Minimum revealed votes for a ruling to bind the escrow. Strict majority of
/// [`PANEL_SIZE`].
pub const QUORUM: u32 = 3;

// The digit grouping below is deliberate: the underscore separates the whole
// LRN amount from its 7-decimal suffix, e.g. `1_000` LRN `_0000000` base
// units, rather than grouping by thousands throughout.
/// Minimum stake to join the eligible-juror pool: 1,000 LRN.
#[allow(clippy::inconsistent_digit_grouping)]
pub const MIN_JUROR_STAKE: i128 = 1_000_0000000;

/// Cap on a single juror's selection weight: 10,000 LRN. Staking beyond this
/// buys no further odds of being drawn onto a panel.
#[allow(clippy::inconsistent_digit_grouping)]
pub const MAX_JUROR_SELECTION_WEIGHT: i128 = 10_000_0000000;

/// Stake a scholar must post to open a dispute: 500 LRN. Forfeited outright
/// if the panel upholds the rejection.
#[allow(clippy::inconsistent_digit_grouping)]
pub const SCHOLAR_DISPUTE_STAKE: i128 = 500_0000000;

/// A dispute must be opened within this many seconds of `rejected_at`.
pub const DISPUTE_WINDOW_SECONDS: u64 = 7 * 24 * 60 * 60;

/// Seconds panel members have to commit a vote after a dispute opens.
pub const COMMIT_WINDOW_SECONDS: u64 = 3 * 24 * 60 * 60;

/// Seconds panel members have to reveal after the commit window closes.
pub const REVEAL_WINDOW_SECONDS: u64 = 2 * 24 * 60 * 60;

/// Portion of a minority (revealed-but-outvoted) juror's stake slashed, in
/// basis points.
pub const MINORITY_SLASH_BPS: u32 = 5_000;

/// Portion of a non-participating (never revealed) juror's stake slashed.
/// Silence is treated as the worse offense: it is what allows a quorum
/// failure and holds the escrow hostage, so it costs the whole stake.
pub const NON_PARTICIPATION_SLASH_BPS: u32 = 10_000;

/// Of the slashed pool, the share redistributed evenly across the majority
/// jurors; the remainder goes to the winning party (the scholar on release,
/// the treasury on an upheld rejection).
pub const MAJORITY_REWARD_SHARE_BPS: u32 = 7_000;

pub const BPS_DENOMINATOR: i128 = 10_000;

/// Upper bound on the eligible-juror pool, so panel selection (which walks
/// the whole pool once per dispute) stays within a predictable CPU budget.
pub const MAX_POOL_SIZE: u32 = 500;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ArbitrationError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    AlreadyJuror = 3,
    NotJuror = 4,
    JurorHasActiveDisputes = 5,
    InvalidStake = 6,
    PoolFull = 7,
    InsufficientPool = 8,
    DisputeExists = 9,
    DisputeNotFound = 10,
    DisputeWindowExpired = 11,
    RejectedAtInFuture = 12,
    WrongPhase = 13,
    NotPanelMember = 14,
    AlreadyCommitted = 15,
    AlreadyRevealed = 16,
    NoCommitment = 17,
    CommitWindowClosed = 18,
    RevealWindowNotOpen = 19,
    RevealWindowClosed = 20,
    CommitmentMismatch = 21,
    NotYetResolvable = 22,
    ArithmeticOverflow = 23,
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const CONFIG_KEY: Symbol = symbol_short!("CONFIG");
const NEXT_ID_KEY: Symbol = symbol_short!("NEXTID");
const JUROR_POOL_KEY: Symbol = symbol_short!("JPOOL");

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub lrn_token: Address,
    pub treasury: Address,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Dispute(u64),
    DisputeByMilestone(u32, u32),
    JurorStake(Address),
    JurorActiveCount(Address),
    Vote(u64, Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DisputePhase {
    /// Commit and/or reveal is in progress; which one is derived from
    /// `commit_deadline`/`reveal_deadline`, not stored separately.
    Active,
    /// Quorum was met; `outcome` is authoritative.
    Resolved,
    /// Quorum was not met by `reveal_deadline`; `outcome` is always `None`.
    QuorumFailed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Dispute {
    pub id: u64,
    pub scholar: Address,
    pub proposal_id: u32,
    pub milestone_id: u32,
    pub evidence_hash: BytesN<32>,
    pub scholar_stake: i128,
    pub opened_at: u64,
    pub panel: Vec<Address>,
    pub commit_deadline: u64,
    pub reveal_deadline: u64,
    pub phase: DisputePhase,
    pub votes_for: u32,
    pub votes_against: u32,
    pub revealed_count: u32,
    /// `Some(true)` releases the tranche, `Some(false)` upholds the
    /// rejection, `None` means quorum failed (nothing is authorized).
    pub outcome: Option<bool>,
    pub resolved_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VoteRecord {
    pub commitment: BytesN<32>,
    pub revealed: bool,
    /// Meaningful only once `revealed` is `true`.
    pub vote: bool,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent(topics = ["juror_joined"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JurorJoined {
    #[topic]
    pub juror: Address,
    pub stake: i128,
}

#[contractevent(topics = ["juror_left"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JurorLeft {
    #[topic]
    pub juror: Address,
    pub stake_returned: i128,
}

#[contractevent(topics = ["dispute_opened"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeOpened {
    #[topic]
    pub dispute_id: u64,
    #[topic]
    pub scholar: Address,
    pub proposal_id: u32,
    pub milestone_id: u32,
    pub evidence_hash: BytesN<32>,
    pub panel: Vec<Address>,
    pub commit_deadline: u64,
    pub reveal_deadline: u64,
}

#[contractevent(topics = ["vote_committed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VoteCommitted {
    #[topic]
    pub dispute_id: u64,
    #[topic]
    pub juror: Address,
}

#[contractevent(topics = ["vote_revealed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VoteRevealed {
    #[topic]
    pub dispute_id: u64,
    #[topic]
    pub juror: Address,
    pub vote: bool,
}

#[contractevent(topics = ["dispute_resolved"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeResolved {
    #[topic]
    pub dispute_id: u64,
    #[topic]
    pub proposal_id: u32,
    pub milestone_id: u32,
    pub outcome: Option<bool>,
    pub votes_for: u32,
    pub votes_against: u32,
    pub revealed_count: u32,
    pub quorum_met: bool,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct MilestoneArbitration;

#[contractimpl]
impl MilestoneArbitration {
    pub fn initialize(env: Env, admin: Address, lrn_token: Address, treasury: Address) {
        if env.storage().instance().has(&CONFIG_KEY) {
            panic_with_error!(&env, ArbitrationError::AlreadyInitialized);
        }
        admin.require_auth();

        let config = Config {
            admin,
            lrn_token,
            treasury,
        };
        env.storage().instance().set(&CONFIG_KEY, &config);
        env.storage().instance().set(&NEXT_ID_KEY, &0u64);
        upgrade::init(&env);
        Self::extend_instance(&env);
    }

    // -----------------------------------------------------------------------
    // Juror pool
    // -----------------------------------------------------------------------

    /// Stake `stake_amount` LRN (>= [`MIN_JUROR_STAKE`]) to join the eligible
    /// juror pool. A given address may only be in the pool once at a time.
    pub fn join_panel(env: Env, juror: Address, stake_amount: i128) {
        juror.require_auth();
        Self::extend_instance(&env);
        let config = Self::config(&env);

        if stake_amount < MIN_JUROR_STAKE {
            panic_with_error!(&env, ArbitrationError::InvalidStake);
        }

        let stake_key = DataKey::JurorStake(juror.clone());
        if env.storage().persistent().has(&stake_key) {
            panic_with_error!(&env, ArbitrationError::AlreadyJuror);
        }

        let mut pool = Self::juror_pool(&env);
        if pool.len() >= MAX_POOL_SIZE {
            panic_with_error!(&env, ArbitrationError::PoolFull);
        }

        Self::token(&env, &config).transfer(&juror, env.current_contract_address(), &stake_amount);

        env.storage().persistent().set(&stake_key, &stake_amount);
        Self::extend_persistent(&env, &stake_key);

        pool.push_back(juror.clone());
        Self::put_juror_pool(&env, &pool);

        let active_key = DataKey::JurorActiveCount(juror.clone());
        env.storage().persistent().set(&active_key, &0u32);
        Self::extend_persistent(&env, &active_key);

        JurorJoined {
            juror,
            stake: stake_amount,
        }
        .publish(&env);
    }

    /// Leave the eligible pool and withdraw the full stake. Only possible
    /// with no active panel assignments, so a juror can never walk away from
    /// a dispute mid-vote to dodge a slash.
    pub fn leave_panel(env: Env, juror: Address) {
        juror.require_auth();
        Self::extend_instance(&env);
        let config = Self::config(&env);

        let stake_key = DataKey::JurorStake(juror.clone());
        let stake: i128 = env
            .storage()
            .persistent()
            .get(&stake_key)
            .unwrap_or_else(|| panic_with_error!(&env, ArbitrationError::NotJuror));

        let active_key = DataKey::JurorActiveCount(juror.clone());
        let active: u32 = env.storage().persistent().get(&active_key).unwrap_or(0);
        if active > 0 {
            panic_with_error!(&env, ArbitrationError::JurorHasActiveDisputes);
        }

        env.storage().persistent().remove(&stake_key);
        env.storage().persistent().remove(&active_key);

        let mut pool = Self::juror_pool(&env);
        if let Some(index) = pool.first_index_of(juror.clone()) {
            pool.remove(index);
        }
        Self::put_juror_pool(&env, &pool);

        if stake > 0 {
            Self::token(&env, &config).transfer(&env.current_contract_address(), &juror, &stake);
        }

        JurorLeft {
            juror,
            stake_returned: stake,
        }
        .publish(&env);
    }

    // -----------------------------------------------------------------------
    // Dispute lifecycle
    // -----------------------------------------------------------------------

    /// Open a dispute over a rejected milestone. Callable only by the scholar
    /// themself (`scholar.require_auth()`), within [`DISPUTE_WINDOW_SECONDS`]
    /// of the caller-supplied `rejected_at`. Draws a panel of [`PANEL_SIZE`]
    /// jurors immediately and returns the new dispute id.
    pub fn open_dispute(
        env: Env,
        scholar: Address,
        proposal_id: u32,
        milestone_id: u32,
        evidence_hash: BytesN<32>,
        rejected_at: u64,
    ) -> u64 {
        scholar.require_auth();
        Self::extend_instance(&env);
        let config = Self::config(&env);

        let now = env.ledger().timestamp();
        if rejected_at > now {
            panic_with_error!(&env, ArbitrationError::RejectedAtInFuture);
        }
        if now.saturating_sub(rejected_at) > DISPUTE_WINDOW_SECONDS {
            panic_with_error!(&env, ArbitrationError::DisputeWindowExpired);
        }

        let milestone_key = DataKey::DisputeByMilestone(proposal_id, milestone_id);
        if env.storage().persistent().has(&milestone_key) {
            panic_with_error!(&env, ArbitrationError::DisputeExists);
        }

        let dispute_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(0);
        let next_id = dispute_id
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(&env, ArbitrationError::ArithmeticOverflow));
        env.storage().instance().set(&NEXT_ID_KEY, &next_id);

        let pool = Self::juror_pool(&env);
        let panel = Self::select_panel(&env, &pool, dispute_id);

        Self::token(&env, &config).transfer(
            &scholar,
            env.current_contract_address(),
            &SCHOLAR_DISPUTE_STAKE,
        );

        for member in panel.iter() {
            let key = DataKey::JurorActiveCount(member.clone());
            let count: u32 = env.storage().persistent().get(&key).unwrap_or(0);
            env.storage().persistent().set(&key, &(count + 1));
            Self::extend_persistent(&env, &key);
        }

        let commit_deadline = now
            .checked_add(COMMIT_WINDOW_SECONDS)
            .unwrap_or_else(|| panic_with_error!(&env, ArbitrationError::ArithmeticOverflow));
        let reveal_deadline = commit_deadline
            .checked_add(REVEAL_WINDOW_SECONDS)
            .unwrap_or_else(|| panic_with_error!(&env, ArbitrationError::ArithmeticOverflow));

        let dispute = Dispute {
            id: dispute_id,
            scholar: scholar.clone(),
            proposal_id,
            milestone_id,
            evidence_hash: evidence_hash.clone(),
            scholar_stake: SCHOLAR_DISPUTE_STAKE,
            opened_at: now,
            panel: panel.clone(),
            commit_deadline,
            reveal_deadline,
            phase: DisputePhase::Active,
            votes_for: 0,
            votes_against: 0,
            revealed_count: 0,
            outcome: None,
            resolved_at: 0,
        };

        let dispute_key = DataKey::Dispute(dispute_id);
        env.storage().persistent().set(&dispute_key, &dispute);
        Self::extend_persistent(&env, &dispute_key);
        env.storage().persistent().set(&milestone_key, &dispute_id);
        Self::extend_persistent(&env, &milestone_key);

        DisputeOpened {
            dispute_id,
            scholar,
            proposal_id,
            milestone_id,
            evidence_hash,
            panel,
            commit_deadline,
            reveal_deadline,
        }
        .publish(&env);

        dispute_id
    }

    /// Submit `sha256(dispute_id ++ vote_byte ++ salt)`. Must come from a
    /// selected panel member, before `commit_deadline`, exactly once.
    pub fn commit_vote(env: Env, dispute_id: u64, juror: Address, commitment: BytesN<32>) {
        juror.require_auth();
        Self::extend_instance(&env);

        let dispute_key = DataKey::Dispute(dispute_id);
        let dispute = Self::get_dispute_or_panic(&env, &dispute_key);

        if dispute.phase != DisputePhase::Active {
            panic_with_error!(&env, ArbitrationError::WrongPhase);
        }
        let now = env.ledger().timestamp();
        if now > dispute.commit_deadline {
            panic_with_error!(&env, ArbitrationError::CommitWindowClosed);
        }
        if dispute.panel.first_index_of(juror.clone()).is_none() {
            panic_with_error!(&env, ArbitrationError::NotPanelMember);
        }

        let vote_key = DataKey::Vote(dispute_id, juror.clone());
        if env.storage().persistent().has(&vote_key) {
            panic_with_error!(&env, ArbitrationError::AlreadyCommitted);
        }

        let record = VoteRecord {
            commitment,
            revealed: false,
            vote: false,
        };
        env.storage().persistent().set(&vote_key, &record);
        Self::extend_persistent(&env, &vote_key);

        VoteCommitted { dispute_id, juror }.publish(&env);
    }

    /// Reveal `(vote, salt)` for a prior commitment. Must fall strictly after
    /// `commit_deadline` and at or before `reveal_deadline`. A reveal that
    /// does not match the stored commitment is rejected outright, never
    /// silently ignored.
    pub fn reveal_vote(env: Env, dispute_id: u64, juror: Address, vote: bool, salt: BytesN<32>) {
        juror.require_auth();
        Self::extend_instance(&env);

        let dispute_key = DataKey::Dispute(dispute_id);
        let mut dispute = Self::get_dispute_or_panic(&env, &dispute_key);

        if dispute.phase != DisputePhase::Active {
            panic_with_error!(&env, ArbitrationError::WrongPhase);
        }
        let now = env.ledger().timestamp();
        if now <= dispute.commit_deadline {
            panic_with_error!(&env, ArbitrationError::RevealWindowNotOpen);
        }
        if now > dispute.reveal_deadline {
            panic_with_error!(&env, ArbitrationError::RevealWindowClosed);
        }

        let vote_key = DataKey::Vote(dispute_id, juror.clone());
        let mut record: VoteRecord = env
            .storage()
            .persistent()
            .get(&vote_key)
            .unwrap_or_else(|| panic_with_error!(&env, ArbitrationError::NoCommitment));
        if record.revealed {
            panic_with_error!(&env, ArbitrationError::AlreadyRevealed);
        }

        let expected = Self::compute_commitment(&env, dispute_id, vote, &salt);
        if expected != record.commitment {
            panic_with_error!(&env, ArbitrationError::CommitmentMismatch);
        }

        record.revealed = true;
        record.vote = vote;
        env.storage().persistent().set(&vote_key, &record);
        Self::extend_persistent(&env, &vote_key);

        if vote {
            dispute.votes_for = dispute
                .votes_for
                .checked_add(1)
                .unwrap_or_else(|| panic_with_error!(&env, ArbitrationError::ArithmeticOverflow));
        } else {
            dispute.votes_against = dispute
                .votes_against
                .checked_add(1)
                .unwrap_or_else(|| panic_with_error!(&env, ArbitrationError::ArithmeticOverflow));
        }
        dispute.revealed_count = dispute
            .revealed_count
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(&env, ArbitrationError::ArithmeticOverflow));
        env.storage().persistent().set(&dispute_key, &dispute);
        Self::extend_persistent(&env, &dispute_key);

        VoteRevealed {
            dispute_id,
            juror,
            vote,
        }
        .publish(&env);
    }

    /// Finalize a dispute. Callable by anyone once every panel member has
    /// revealed, or once `reveal_deadline` has passed — a dispute can never
    /// hang forever. See the module docs for the full quorum/slashing model.
    pub fn resolve(env: Env, dispute_id: u64) {
        Self::extend_instance(&env);
        let config = Self::config(&env);
        let dispute_key = DataKey::Dispute(dispute_id);
        let mut dispute = Self::get_dispute_or_panic(&env, &dispute_key);

        if dispute.phase != DisputePhase::Active {
            panic_with_error!(&env, ArbitrationError::WrongPhase);
        }
        let now = env.ledger().timestamp();
        let panel_size = dispute.panel.len();
        let all_revealed = dispute.revealed_count >= panel_size;
        if !all_revealed && now <= dispute.reveal_deadline {
            panic_with_error!(&env, ArbitrationError::NotYetResolvable);
        }

        let token = Self::token(&env, &config);
        let quorum_met = dispute.revealed_count >= QUORUM;

        if quorum_met {
            Self::resolve_with_quorum(&env, &token, &config, &mut dispute);
        } else {
            Self::resolve_quorum_failed(&env, &token, &config, &mut dispute);
        }

        env.storage().persistent().set(&dispute_key, &dispute);
        Self::extend_persistent(&env, &dispute_key);

        DisputeResolved {
            dispute_id,
            proposal_id: dispute.proposal_id,
            milestone_id: dispute.milestone_id,
            outcome: dispute.outcome,
            votes_for: dispute.votes_for,
            votes_against: dispute.votes_against,
            revealed_count: dispute.revealed_count,
            quorum_met,
        }
        .publish(&env);
    }

    // -----------------------------------------------------------------------
    // Read functions
    // -----------------------------------------------------------------------

    pub fn get_dispute(env: Env, dispute_id: u64) -> Option<Dispute> {
        env.storage()
            .persistent()
            .get(&DataKey::Dispute(dispute_id))
    }

    pub fn get_dispute_for_milestone(env: Env, proposal_id: u32, milestone_id: u32) -> Option<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::DisputeByMilestone(proposal_id, milestone_id))
    }

    pub fn get_vote(env: Env, dispute_id: u64, juror: Address) -> Option<VoteRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::Vote(dispute_id, juror))
    }

    pub fn get_juror_stake(env: Env, juror: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::JurorStake(juror))
            .unwrap_or(0)
    }

    pub fn get_juror_active_count(env: Env, juror: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::JurorActiveCount(juror))
            .unwrap_or(0)
    }

    pub fn is_juror(env: Env, juror: Address) -> bool {
        env.storage().persistent().has(&DataKey::JurorStake(juror))
    }

    pub fn get_juror_pool(env: Env) -> Vec<Address> {
        Self::juror_pool(&env)
    }

    pub fn get_config(env: Env) -> Config {
        Self::config(&env)
    }

    /// `(panel_size, quorum, min_juror_stake, max_juror_selection_weight,
    /// scholar_dispute_stake, dispute_window_seconds, commit_window_seconds,
    /// reveal_window_seconds)`.
    pub fn get_params(_env: Env) -> (u32, u32, i128, i128, i128, u64, u64, u64) {
        (
            PANEL_SIZE,
            QUORUM,
            MIN_JUROR_STAKE,
            MAX_JUROR_SELECTION_WEIGHT,
            SCHOLAR_DISPUTE_STAKE,
            DISPUTE_WINDOW_SECONDS,
            COMMIT_WINDOW_SECONDS,
            REVEAL_WINDOW_SECONDS,
        )
    }

    /// The escrow-release authorization surface: `Some((proposal_id,
    /// milestone_id, release))` once resolved with quorum, `None` if the
    /// dispute doesn't exist, hasn't resolved, or resolved via quorum
    /// failure. `milestone_escrow` should reject anything but
    /// `Some((matching_proposal_id, _, true))`.
    pub fn get_release_outcome(env: Env, dispute_id: u64) -> Option<(u32, u32, bool)> {
        let dispute: Option<Dispute> = env
            .storage()
            .persistent()
            .get(&DataKey::Dispute(dispute_id));
        dispute.and_then(|d| {
            d.outcome
                .map(|release| (d.proposal_id, d.milestone_id, release))
        })
    }

    pub fn get_version(env: Env) -> String {
        String::from_str(&env, "1.0.0")
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    /// Replace the current contract WASM with a new uploaded hash. Admin only.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin = Self::config(&env).admin;
        admin.require_auth();
        upgrade::apply(&env, &admin, &new_wasm_hash);
    }

    // -----------------------------------------------------------------------
    // Internal: resolution
    // -----------------------------------------------------------------------

    fn resolve_quorum_failed(
        env: &Env,
        token: &token::Client,
        config: &Config,
        dispute: &mut Dispute,
    ) {
        let now = env.ledger().timestamp();
        dispute.phase = DisputePhase::QuorumFailed;
        dispute.outcome = None;
        dispute.resolved_at = now;

        if dispute.scholar_stake > 0 {
            token.transfer(
                &env.current_contract_address(),
                &dispute.scholar,
                &dispute.scholar_stake,
            );
        }

        let mut slashed_total: i128 = 0;
        for juror in dispute.panel.iter() {
            let revealed = Self::did_reveal(env, dispute.id, &juror);
            Self::release_assignment(env, &juror);
            if revealed {
                continue;
            }
            let stake_key = DataKey::JurorStake(juror.clone());
            let stake: i128 = env.storage().persistent().get(&stake_key).unwrap_or(0);
            let slash = Self::bps_of(env, stake, NON_PARTICIPATION_SLASH_BPS);
            if slash > 0 {
                env.storage().persistent().set(&stake_key, &(stake - slash));
                slashed_total += slash;
            }
        }
        if slashed_total > 0 {
            token.transfer(
                &env.current_contract_address(),
                &config.treasury,
                &slashed_total,
            );
        }
    }

    fn resolve_with_quorum(
        env: &Env,
        token: &token::Client,
        config: &Config,
        dispute: &mut Dispute,
    ) {
        let now = env.ledger().timestamp();
        let release = dispute.votes_for > dispute.votes_against;
        let is_tie = dispute.votes_for == dispute.votes_against;
        dispute.phase = DisputePhase::Resolved;
        dispute.outcome = Some(release);
        dispute.resolved_at = now;

        // The value a *minority* voter would have cast. Meaningless on a tie.
        let minority_vote = !release;

        let mut majority_jurors: Vec<Address> = Vec::new(env);
        let mut slashed_total: i128 = 0;

        for juror in dispute.panel.iter() {
            let revealed = Self::did_reveal(env, dispute.id, &juror);
            let stake_key = DataKey::JurorStake(juror.clone());
            let stake: i128 = env.storage().persistent().get(&stake_key).unwrap_or(0);

            let slash = if !revealed {
                Self::bps_of(env, stake, NON_PARTICIPATION_SLASH_BPS)
            } else if !is_tie && Self::juror_vote(env, dispute.id, &juror) == minority_vote {
                Self::bps_of(env, stake, MINORITY_SLASH_BPS)
            } else {
                0
            };

            if slash > 0 {
                env.storage().persistent().set(&stake_key, &(stake - slash));
                slashed_total += slash;
            } else if revealed {
                majority_jurors.push_back(juror.clone());
            }
            Self::release_assignment(env, &juror);
        }

        // The scholar's own stake joins the slashed pool only when the
        // rejection is upheld (a losing dispute is, by this design, treated
        // as frivolous); otherwise it is returned in full.
        let mut pool = slashed_total;
        if release {
            if dispute.scholar_stake > 0 {
                token.transfer(
                    &env.current_contract_address(),
                    &dispute.scholar,
                    &dispute.scholar_stake,
                );
            }
        } else {
            pool += dispute.scholar_stake;
        }

        if pool > 0 {
            let majority_share = Self::bps_of(env, pool, MAJORITY_REWARD_SHARE_BPS);
            let winner_share = pool - majority_share;
            let juror_count = majority_jurors.len();

            if majority_share > 0 && juror_count > 0 {
                let each = majority_share / (juror_count as i128);
                let dust = majority_share - each * (juror_count as i128);
                if each > 0 {
                    for juror in majority_jurors.iter() {
                        let stake_key = DataKey::JurorStake(juror.clone());
                        let stake: i128 = env.storage().persistent().get(&stake_key).unwrap_or(0);
                        env.storage().persistent().set(&stake_key, &(stake + each));
                    }
                }
                if dust > 0 {
                    token.transfer(&env.current_contract_address(), &config.treasury, &dust);
                }
            } else if majority_share > 0 {
                token.transfer(
                    &env.current_contract_address(),
                    &config.treasury,
                    &majority_share,
                );
            }

            if winner_share > 0 {
                let winner = if release {
                    dispute.scholar.clone()
                } else {
                    config.treasury.clone()
                };
                token.transfer(&env.current_contract_address(), &winner, &winner_share);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Internal: panel selection
    // -----------------------------------------------------------------------

    /// Draw [`PANEL_SIZE`] jurors from `pool` without replacement, weighted
    /// by each juror's stake (capped at [`MAX_JUROR_SELECTION_WEIGHT`]) and
    /// seeded from the dispute id plus the ledger's sequence and timestamp at
    /// the moment of the draw — neither of which the caller controls at the
    /// time they submit the `open_dispute` transaction.
    fn select_panel(env: &Env, pool: &Vec<Address>, dispute_id: u64) -> Vec<Address> {
        if pool.len() < PANEL_SIZE {
            panic_with_error!(env, ArbitrationError::InsufficientPool);
        }

        let mut candidates: Vec<Address> = Vec::new(env);
        let mut weights: Vec<i128> = Vec::new(env);
        for juror in pool.iter() {
            let stake: i128 = env
                .storage()
                .persistent()
                .get(&DataKey::JurorStake(juror.clone()))
                .unwrap_or(0);
            let weight = stake.min(MAX_JUROR_SELECTION_WEIGHT);
            if weight > 0 {
                candidates.push_back(juror.clone());
                weights.push_back(weight);
            }
        }
        if candidates.len() < PANEL_SIZE {
            panic_with_error!(env, ArbitrationError::InsufficientPool);
        }

        let mut selected: Vec<Address> = Vec::new(env);
        let mut draw: u32 = 0;
        while selected.len() < PANEL_SIZE {
            let mut total_weight: i128 = 0;
            for w in weights.iter() {
                total_weight += w;
            }

            let ticket = (Self::draw_u128(env, dispute_id, draw) % (total_weight as u128)) as i128;
            let mut cumulative: i128 = 0;
            let mut pick_index: u32 = 0;
            for i in 0..weights.len() {
                cumulative += weights.get(i).unwrap();
                if ticket < cumulative {
                    pick_index = i;
                    break;
                }
            }

            let picked = candidates.get(pick_index).unwrap();
            selected.push_back(picked);
            candidates.remove(pick_index);
            weights.remove(pick_index);
            draw = draw
                .checked_add(1)
                .unwrap_or_else(|| panic_with_error!(env, ArbitrationError::ArithmeticOverflow));
        }
        selected
    }

    fn draw_u128(env: &Env, dispute_id: u64, counter: u32) -> u128 {
        let mut bytes = Bytes::new(env);
        bytes.append(&Bytes::from_array(env, &dispute_id.to_be_bytes()));
        bytes.append(&Bytes::from_array(
            env,
            &env.ledger().sequence().to_be_bytes(),
        ));
        bytes.append(&Bytes::from_array(
            env,
            &env.ledger().timestamp().to_be_bytes(),
        ));
        bytes.append(&Bytes::from_array(env, &counter.to_be_bytes()));

        let hash: BytesN<32> = env.crypto().sha256(&bytes).into();
        let arr = hash.to_array();
        let mut buf = [0u8; 16];
        buf.copy_from_slice(&arr[0..16]);
        u128::from_be_bytes(buf)
    }

    fn compute_commitment(env: &Env, dispute_id: u64, vote: bool, salt: &BytesN<32>) -> BytesN<32> {
        let mut bytes = Bytes::new(env);
        bytes.append(&Bytes::from_array(env, &dispute_id.to_be_bytes()));
        bytes.append(&Bytes::from_array(env, &[if vote { 1u8 } else { 0u8 }]));
        bytes.append(&Bytes::from(salt.clone()));
        env.crypto().sha256(&bytes).into()
    }

    // -----------------------------------------------------------------------
    // Internal: storage helpers
    // -----------------------------------------------------------------------

    fn config(env: &Env) -> Config {
        env.storage()
            .instance()
            .get(&CONFIG_KEY)
            .unwrap_or_else(|| panic_with_error!(env, ArbitrationError::NotInitialized))
    }

    fn token<'a>(env: &Env, config: &Config) -> token::Client<'a> {
        token::Client::new(env, &config.lrn_token)
    }

    fn juror_pool(env: &Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&JUROR_POOL_KEY)
            .unwrap_or_else(|| Vec::new(env))
    }

    fn put_juror_pool(env: &Env, pool: &Vec<Address>) {
        env.storage().instance().set(&JUROR_POOL_KEY, pool);
    }

    fn get_dispute_or_panic(env: &Env, key: &DataKey) -> Dispute {
        env.storage()
            .persistent()
            .get(key)
            .unwrap_or_else(|| panic_with_error!(env, ArbitrationError::DisputeNotFound))
    }

    fn did_reveal(env: &Env, dispute_id: u64, juror: &Address) -> bool {
        let key = DataKey::Vote(dispute_id, juror.clone());
        env.storage()
            .persistent()
            .get::<_, VoteRecord>(&key)
            .map(|r| r.revealed)
            .unwrap_or(false)
    }

    fn juror_vote(env: &Env, dispute_id: u64, juror: &Address) -> bool {
        let key = DataKey::Vote(dispute_id, juror.clone());
        env.storage()
            .persistent()
            .get::<_, VoteRecord>(&key)
            .map(|r| r.vote)
            .unwrap_or(false)
    }

    fn release_assignment(env: &Env, juror: &Address) {
        let key = DataKey::JurorActiveCount(juror.clone());
        let count: u32 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&key, &count.saturating_sub(1));
    }

    fn bps_of(env: &Env, amount: i128, bps: u32) -> i128 {
        amount
            .checked_mul(bps as i128)
            .unwrap_or_else(|| panic_with_error!(env, ArbitrationError::ArithmeticOverflow))
            / BPS_DENOMINATOR
    }

    fn extend_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_EXTEND_TO);
    }

    fn extend_persistent(env: &Env, key: &DataKey) {
        env.storage()
            .persistent()
            .extend_ttl(key, PERSISTENT_BUMP_THRESHOLD, PERSISTENT_EXTEND_TO);
    }
}

#[cfg(test)]
mod test;
