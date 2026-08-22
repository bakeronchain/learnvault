#![no_std]
#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    Address, BytesN, Env, String, Symbol, Vec, contract, contracterror, contractevent,
    contractimpl, contracttype, panic_with_error, symbol_short,
};

use learnvault_shared::upgrade;

pub use upgrade::ContractUpgraded;

// ---------------------------------------------------------------------------
// Storage Constants (assuming ~6s ledger time)
// ---------------------------------------------------------------------------

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const INSTANCE_EXTEND_TO: u32 = DAY_IN_LEDGERS * 30; // 30 days
const PERSISTENT_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const PERSISTENT_EXTEND_TO: u32 = DAY_IN_LEDGERS * 365; // 1 year

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const GOV_KEY: Symbol = symbol_short!("GOV");
const USDC_KEY: Symbol = symbol_short!("USDC");
const TOTAL_KEY: Symbol = symbol_short!("TOTAL");
const NEXT_PROPOSAL_KEY: Symbol = symbol_short!("NEXTPROP");
const DISBURSED_KEY: Symbol = symbol_short!("DISBURSED");
const SCHOLARS_KEY: Symbol = symbol_short!("SCHOLARS");
const DONORS_KEY: Symbol = symbol_short!("DONORS");
const PAUSED_KEY: Symbol = symbol_short!("PAUSED");
const TOTAL_GOV_KEY: Symbol = symbol_short!("TOTALGOV");
const MIN_LRN_TO_PROPOSE_KEY: Symbol = symbol_short!("MINPROP");
const SUPPORTED_ASSETS_KEY: Symbol = symbol_short!("ASSETS");
const GOV_PER_USDC: i128 = 100;
const PROPOSAL_DEADLINE_LEDGERS: u32 = 100_800;
const VOTING_PERIOD_KEY: Symbol = symbol_short!("VOTEPRD");
const QUORUM_KEY: Symbol = symbol_short!("QUORUM");
const APPROVAL_BPS_KEY: Symbol = symbol_short!("APPBPS");
const MILESTONE_COUNT_KEY: Symbol = symbol_short!("MSCNT");
const TIMELOCK_LEDGER_KEY: Symbol = symbol_short!("TLOCK");
const DEFAULT_TIMELOCK_LEDGERS: u32 = DAY_IN_LEDGERS * 2; // 48 hours

// --- Yield strategy (allocation) controls -----------------------------------
// `MAX_ALLOC_BPS` is the governance-set ceiling (in basis points) on the share
// of total treasury value that may ever be at risk in strategies. Enforced on
// every allocation.
const MAX_ALLOC_BPS_KEY: Symbol = symbol_short!("MAXALOC");
// `LIQ_BUFFER_BPS` is the liquidity-buffer margin (in basis points) that must
// remain idle *on top of* all approved-but-unpaid proposals. Allocating below
// this floor is rejected so an approved scholarship can never be blocked by an
// investment.
const LIQ_BUFFER_BPS_KEY: Symbol = symbol_short!("BUFBPS");
// Registered strategy adapter address.
const STRATEGY_KEY: Symbol = symbol_short!("STRATGY");
// Outstanding principal currently at risk in strategies (atomic units).
const ALLOC_PRINCIPAL_KEY: Symbol = symbol_short!("ALLOCP");
// Outstanding unrealized yield currently held at the strategy (atomic units).
const ALLOC_YIELD_KEY: Symbol = symbol_short!("ALLOCY");
// Cumulative yield recognized/harvested into the treasury to date (reporting).
const TOTAL_YIELD_KEY: Symbol = symbol_short!("YLDACC");
// Conservative defaults. These are policy knobs; the DAO (via admin, itself
// governed) may raise or lower them after execution.
const DEFAULT_MAX_ALLOC_BPS: u32 = 2_500; // 25% of treasury value at most
const DEFAULT_LIQUIDITY_BUFFER_BPS: u32 = 2_000; // +20% margin over committed
// Running total of approved-but-unpaid disbursement proposals. The liquidity
// buffer must always keep idle balance above this commitment. Maintained as a
// single counter because Soroban persistent storage does not expose key
// enumeration.
const COMMITTED_KEY: Symbol = symbol_short!("CMTMEU");

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Donor(Address),
    Proposal(u32),
    ApplicantProposals(Address),
    Scholar(Address),
    VoteCast(u32, Address), // (proposal_id, voter) -> bool
    FinalizedProposal(u32), // proposal_id -> ProposalStatus (set by finalize_proposal)
    VetoCast(u32, Address), // (proposal_id, voter) -> bool
    AssetDeposited(Address), // total deposited per asset (atomic units)
}

#[contractevent(topics = ["proposal_executed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalExecuted {
    #[topic]
    pub proposal_id: u32,
    pub passed: bool,
    pub amount: i128,
}

#[contractevent(topics = ["proposal_cancelled"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalCancelled {
    #[topic]
    pub proposal_id: u32,
    pub cancelled_by: Address,
}

#[contractevent(topics = ["proposal_queued"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalQueued {
    #[topic]
    pub proposal_id: u32,
    pub queued_at: u32,
    pub execution_ready_at: u32,
}

#[contractevent(topics = ["allocated"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Allocated {
    #[topic]
    pub strategy: Address,
    pub amount: i128,
}

#[contractevent(topics = ["deallocated"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Deallocated {
    #[topic]
    pub strategy: Address,
    pub amount: i128,
    pub returned: i128,
}

#[contractevent(topics = ["harvested"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Harvested {
    #[topic]
    pub strategy: Address,
    pub amount: i128,
    pub yield_amount: i128,
}

#[contractevent(topics = ["emergency_withdraw"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmergencyWithdrawal {
    #[topic]
    pub strategy: Address,
    pub amount: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct Proposal {
    pub id: u32,
    pub applicant: Address,
    pub amount: i128,
    pub program_name: String,
    pub program_url: String,
    pub program_description: String,
    pub start_date: String,
    pub milestone_titles: Vec<String>,
    pub milestone_dates: Vec<String>,
    pub submitted_at: u64,
    pub yes_votes: i128,
    pub no_votes: i128,
    pub deadline_ledger: u32,
    pub executed: bool,
    pub cancelled: bool,
    pub kind: ProposalKind,
    // Target strategy for allocation/deallocation proposals (None otherwise).
    pub strategy: Option<Address>,
    // Fields for parameter change proposals (optional)
    pub new_quorum: i128,
    pub new_approval_bps: u32,
    pub new_voting_period: u32,
    pub queued_at: u32,
    pub veto_votes: i128,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ProposalStatus {
    Pending,
    Queued,
    Approved,
    Rejected,
    Executed,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ProposalKind {
    Disbursement,
    ParameterChange,
    Allocation,
    Deallocation,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidAmount = 3,
    InsufficientFunds = 4,
    ContractPaused = 5,
    ProposalNotFound = 6,
    AlreadyVoted = 7,
    VotingClosed = 8,
    /// Votes cast after the proposal's voting deadline.
    VotingPeriodEnded = 9,
    /// finalize_proposal called before the voting deadline has passed.
    TooEarlyToFinalize = 10,
    /// Proposal finalized but total votes cast did not reach MIN_QUORUM_BPS.
    QuorumNotMet = 11,
    InsufficientReputation = 12,
    VotingNotClosed = 13,
    ProposalAlreadyExecuted = 14,
    ProposalRejected = 15,
    ProposalCancelled = 16,
    Unauthorized = 17,
    ArithmeticOverflow = 18,
    /// Milestone titles/dates count does not match the configured milestone count.
    InvalidMilestoneCount = 19,
    /// Timelock period has not elapsed yet.
    TimelockNotExpired = 20,
    /// Proposal is not in Queued status.
    NotQueued = 21,
    /// Supermajority veto threshold has not been reached.
    VetoNotMet = 22,
    /// Asset is not in the supported assets list.
    UnsupportedAsset = 23,
    /// No strategy adapter is registered for allocation.
    StrategyNotRegistered = 24,
    /// Allocation would exceed the governance-set max_allocation_bps ceiling.
    AllocationCapExceeded = 25,
    /// Allocation would leave idle balance below the liquidity buffer floor.
    LiquidityBufferBreached = 26,
    /// Amount to deallocate exceeds the outstanding principal at the strategy.
    ExceedsAllocated = 27,
    /// The supplied strategy address is not the registered adapter.
    UnknownStrategy = 28,
}

#[contract]
pub struct ScholarshipTreasury;

#[contractevent(topics = ["deposit"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DepositRecorded {
    #[topic]
    pub donor: Address,
    pub amount: i128,
    pub asset: Address,
}

#[contractevent(topics = ["gov_issued"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GovIssued {
    #[topic]
    pub donor: Address,
    pub usdc_amount: i128,
    pub gov_amount: i128,
}

#[contractevent(topics = ["disburse"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisbursementRecorded {
    #[topic]
    pub recipient: Address,
    pub amount: i128,
}

#[contractevent(topics = ["proposal"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalSubmitted {
    #[topic]
    pub applicant: Address,
    #[topic]
    pub proposal_id: u32,
    pub amount: i128,
}

#[contractevent(topics = ["vote"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VoteCastEvent {
    #[topic]
    pub voter: Address,
    #[topic]
    pub proposal_id: u32,
    pub support: bool,
    pub weight: i128,
}

const TIMELOCK_VAULT_KEY: Symbol = symbol_short!("TLVAULT");

#[contractevent(topics = ["pause_changed"])]
pub struct PauseChanged {
    #[topic]
    pub paused: bool,
}

#[contractimpl]
#[allow(clippy::too_many_arguments)]
impl ScholarshipTreasury {
    pub fn initialize(
        env: Env,
        admin: Address,
        usdc_token: Address,
        governance_contract: Address,
        quorum_threshold: i128,
        approval_bps: u32,
    ) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();

        if quorum_threshold < 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        if approval_bps > 10_000 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        env.storage().instance().set(&ADMIN_KEY, &admin);
        upgrade::init(&env);
        env.storage().instance().set(&USDC_KEY, &usdc_token);

        // Seed supported assets list with USDC as the primary asset
        let mut initial_assets: Vec<Address> = Vec::new(&env);
        initial_assets.push_back(usdc_token.clone());
        env.storage()
            .instance()
            .set(&SUPPORTED_ASSETS_KEY, &initial_assets);
        env.storage().instance().set(&GOV_KEY, &governance_contract);
        env.storage().instance().set(&TOTAL_KEY, &0_i128);
        env.storage().instance().set(&NEXT_PROPOSAL_KEY, &1_u32);
        env.storage().instance().set(&DISBURSED_KEY, &0_i128);
        env.storage().instance().set(&SCHOLARS_KEY, &0_u32);
        env.storage().instance().set(&DONORS_KEY, &0_u32);
        env.storage().instance().set(&PAUSED_KEY, &false);
        env.storage()
            .instance()
            .set(&MIN_LRN_TO_PROPOSE_KEY, &0_i128);

        env.storage().instance().set(&QUORUM_KEY, &quorum_threshold);
        env.storage()
            .instance()
            .set(&APPROVAL_BPS_KEY, &approval_bps);
        // Default to 3 milestones; use set_milestone_count to override.
        env.storage()
            .instance()
            .set(&MILESTONE_COUNT_KEY, &3_u32);

        Self::extend_instance(&env);
    }

    pub fn get_quorum(env: Env) -> i128 {
        Self::extend_instance(&env);
        env.storage()
            .instance()
            .get::<_, i128>(&QUORUM_KEY)
            .unwrap_or(0)
    }

    pub fn get_approval_bps(env: Env) -> u32 {
        Self::extend_instance(&env);
        env.storage()
            .instance()
            .get::<_, u32>(&APPROVAL_BPS_KEY)
            .unwrap_or(0)
    }

    // New getter for voting period (in ledger steps)
    pub fn get_voting_period(env: Env) -> u32 {
        Self::extend_instance(&env);
        env.storage()
            .instance()
            .get::<_, u32>(&VOTING_PERIOD_KEY)
            .unwrap_or(PROPOSAL_DEADLINE_LEDGERS)
    }

    pub fn set_quorum(env: Env, new_quorum: i128) {
        let admin = Self::admin(&env);
        admin.require_auth();
        if new_quorum < 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        env.storage().instance().set(&QUORUM_KEY, &new_quorum);
    }

    pub fn set_approval_bps(env: Env, new_bps: u32) {
        let admin = Self::admin(&env);
        admin.require_auth();
        if new_bps > 10_000 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        env.storage().instance().set(&APPROVAL_BPS_KEY, &new_bps);
    }

    /// Admin-only: set the voting period in ledgers.
    pub fn set_voting_period(env: Env, new_period: u32) {
        let admin = Self::admin(&env);
        admin.require_auth();
        if new_period == 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        env.storage().instance().set(&VOTING_PERIOD_KEY, &new_period);
    }

    /// Admin-only: set the timelock delay in ledgers.
    pub fn set_timelock_delay(env: Env, admin: Address, ledgers: u32) {
        admin.require_auth();
        if admin != Self::admin(&env) {
            panic_with_error!(&env, Error::Unauthorized);
        }
        if ledgers == 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        env.storage().instance().set(&TIMELOCK_LEDGER_KEY, &ledgers);
    }

    /// Get the current timelock delay in ledgers.
    pub fn get_timelock_delay(env: Env) -> u32 {
        Self::extend_instance(&env);
        env.storage()
            .instance()
            .get::<_, u32>(&TIMELOCK_LEDGER_KEY)
            .unwrap_or(DEFAULT_TIMELOCK_LEDGERS)
    }

    /// Returns the configured number of milestones required per proposal.
    pub fn get_milestone_count(env: Env) -> u32 {
        Self::extend_instance(&env);
        env.storage()
            .instance()
            .get::<_, u32>(&MILESTONE_COUNT_KEY)
            .unwrap_or(3)
    }

    /// Admin-only: update the required milestone count for future proposals.
    pub fn set_milestone_count(env: Env, count: u32) {
        let admin = Self::admin(&env);
        admin.require_auth();
        if count == 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        env.storage().instance().set(&MILESTONE_COUNT_KEY, &count);
    }

    /// Public getter for admin address
    pub fn get_admin(env: Env) -> Address {
        Self::admin(&env)
    }

    /// Set the timelock vault address (admin only)
    pub fn set_timelock_vault(env: Env, vault: Address) {
        let admin = Self::admin(&env);
        admin.require_auth();
        env.storage().instance().set(&TIMELOCK_VAULT_KEY, &vault);
    }

    /// Get the timelock vault address if configured
    pub fn get_timelock_vault(env: Env) -> Option<Address> {
        env.storage().instance().get(&TIMELOCK_VAULT_KEY)
    }

    pub fn pause(env: Env) {
        let admin = Self::admin(&env);
        admin.require_auth();
        env.storage().instance().set(&PAUSED_KEY, &true);
        // Emit pause event
        PauseChanged { paused: true }.publish(&env);
    }

    pub fn unpause(env: Env) {
        let admin = Self::admin(&env);
        admin.require_auth();
        env.storage().instance().set(&PAUSED_KEY, &false);
        PauseChanged { paused: false }.publish(&env);
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get::<_, bool>(&PAUSED_KEY)
            .unwrap_or(false)
    }

    pub fn deposit(env: Env, donor: Address, amount: i128, asset: Address) {
        Self::assert_not_paused(&env);

        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        donor.require_auth();

        // Validate asset is in the supported list
        let supported: Vec<Address> = env
            .storage()
            .instance()
            .get(&SUPPORTED_ASSETS_KEY)
            .unwrap_or(Vec::new(&env));
        if !supported.contains(&asset) {
            panic_with_error!(&env, Error::UnsupportedAsset);
        }

        // Transfer the deposited asset to the contract
        soroban_sdk::token::TokenClient::new(&env, &asset)
            .transfer(&donor, &env.current_contract_address(), &amount);

        let gov_contract = Self::governance_contract(&env);
        let gov_client = governance::client(&env, &gov_contract);
        let gov_amount = amount
            .checked_mul(GOV_PER_USDC)
            .unwrap_or_else(|| panic_with_error!(&env, Error::InvalidAmount));
        gov_client.mint(&donor, &gov_amount);
        GovIssued {
            donor: donor.clone(),
            usdc_amount: amount,
            gov_amount,
        }
        .publish(&env);

        // Track total GOV issued for quorum calculations
        let total_gov = env
            .storage()
            .instance()
            .get::<_, i128>(&TOTAL_GOV_KEY)
            .unwrap_or(0);
        let new_total_gov = Self::checked_add_i128(&env, total_gov, gov_amount);
        env.storage().instance().set(&TOTAL_GOV_KEY, &new_total_gov);

        // Track per-asset total deposited
        let asset_key = DataKey::AssetDeposited(asset.clone());
        let asset_current = env
            .storage()
            .persistent()
            .get::<_, i128>(&asset_key)
            .unwrap_or(0);
        let new_asset_total = Self::checked_add_i128(&env, asset_current, amount);
        env.storage().persistent().set(&asset_key, &new_asset_total);
        Self::extend_persistent(&env, &asset_key);

        let donor_key = DataKey::Donor(donor.clone());
        let current = env
            .storage()
            .persistent()
            .get::<_, i128>(&donor_key)
            .unwrap_or(0);

        if current == 0 {
            let donors_count = env
                .storage()
                .instance()
                .get::<_, u32>(&DONORS_KEY)
                .unwrap_or(0);
            let new_donors_count = Self::checked_add_u32(&env, donors_count, 1);
            env.storage().instance().set(&DONORS_KEY, &new_donors_count);
        }

        let new_donor_total = Self::checked_add_i128(&env, current, amount);
        env.storage().persistent().set(&donor_key, &new_donor_total);

        Self::extend_persistent(&env, &donor_key);

        // Only USDC deposits count toward the disbursable TOTAL_KEY balance
        let usdc_address: Address = env
            .storage()
            .instance()
            .get::<_, Address>(&USDC_KEY)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));
        if asset == usdc_address {
            let total = env
                .storage()
                .instance()
                .get::<_, i128>(&TOTAL_KEY)
                .unwrap_or(0);
            let new_total = Self::checked_add_i128(&env, total, amount);
            env.storage().instance().set(&TOTAL_KEY, &new_total);
        }

        DepositRecorded { donor, amount, asset }.publish(&env);
    }

    pub fn disburse(env: Env, recipient: Address, amount: i128) {
        Self::assert_not_paused(&env);

        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let governance = Self::governance_contract(&env);
        governance.require_auth();

        let total = env
            .storage()
            .instance()
            .get::<_, i128>(&TOTAL_KEY)
            .unwrap_or(0);
        if amount > total {
            panic_with_error!(&env, Error::InsufficientFunds);
        }

        let new_total = Self::checked_sub_i128(&env, total, amount);
        env.storage().instance().set(&TOTAL_KEY, &new_total);

        let disbursed = env
            .storage()
            .instance()
            .get::<_, i128>(&DISBURSED_KEY)
            .unwrap_or(0);
        let new_disbursed = Self::checked_add_i128(&env, disbursed, amount);
        env.storage().instance().set(&DISBURSED_KEY, &new_disbursed);

        let scholar_key = DataKey::Scholar(recipient.clone());
        if !env.storage().persistent().has(&scholar_key) {
            let scholars_count = env
                .storage()
                .instance()
                .get::<_, u32>(&SCHOLARS_KEY)
                .unwrap_or(0);
            let new_scholars_count = Self::checked_add_u32(&env, scholars_count, 1);
            env.storage()
                .instance()
                .set(&SCHOLARS_KEY, &new_scholars_count);
            env.storage().persistent().set(&scholar_key, &true);
            Self::extend_persistent(&env, &scholar_key);
        }

        token::client(&env).transfer(&env.current_contract_address(), &recipient, &amount);

        DisbursementRecorded { recipient, amount }.publish(&env);
    }

    pub fn execute_proposal(env: Env, proposal_id: u32) {
        Self::assert_initialized(&env);
        Self::assert_not_paused(&env);

        let mut proposal = env
            .storage()
            .persistent()
            .get::<_, Proposal>(&DataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::ProposalNotFound));

        if proposal.cancelled {
            panic_with_error!(&env, Error::ProposalCancelled);
        }

        if proposal.executed {
            panic_with_error!(&env, Error::ProposalAlreadyExecuted);
        }

        // Must be in queued state (or legacy Approved state)
        let finalized_status = env
            .storage()
            .persistent()
            .get::<_, ProposalStatus>(&DataKey::FinalizedProposal(proposal_id));
        let is_queued = match finalized_status {
            Some(ProposalStatus::Queued) => true,
            Some(ProposalStatus::Approved) => !proposal.executed, // legacy pre-timelock
            _ => false,
        };
        if !is_queued {
            panic_with_error!(&env, Error::NotQueued);
        }

        let timelock_delay = Self::get_timelock_delay(env.clone());
        let ready_at = Self::checked_add_u32(
            &env,
            proposal.queued_at,
            timelock_delay,
        );
        if env.ledger().sequence() < ready_at {
            panic_with_error!(&env, Error::TimelockNotExpired);
        }

        let total_votes = Self::checked_add_i128(&env, proposal.yes_votes, proposal.no_votes);
        let quorum_threshold = Self::get_quorum(env.clone());
        let approval_bps = Self::get_approval_bps(env.clone());

        let passed = total_votes >= quorum_threshold
            && total_votes > 0
            && proposal
                .yes_votes
                .checked_mul(10_000)
                .map(|v| (v / total_votes) as u32 > approval_bps)
                .unwrap_or(false);

        proposal.executed = true;
        // Handle based on proposal kind
        match proposal.kind {
            ProposalKind::Disbursement => {
                if passed {
                    Self::disburse_internal(&env, &proposal.applicant, proposal.amount);
                }
            },
            ProposalKind::ParameterChange => {
                if passed {
                    if proposal.new_quorum > 0 {
                        env.storage().instance().set(&QUORUM_KEY, &proposal.new_quorum);
                    }
                    if proposal.new_approval_bps > 0 {
                        env.storage().instance().set(&APPROVAL_BPS_KEY, &proposal.new_approval_bps);
                    }
                    if proposal.new_voting_period > 0 {
                        env.storage().instance().set(&VOTING_PERIOD_KEY, &proposal.new_voting_period);
                    }
                }
            },
            ProposalKind::Allocation => {
                if passed {
                    if !proposal.strategy.is_some() {
                        panic_with_error!(&env, Error::StrategyNotRegistered);
                    }
                    Self::allocate_internal(
                        &env,
                        proposal.strategy.clone().unwrap(),
                        proposal.amount,
                    );
                }
            },
            ProposalKind::Deallocation => {
                if passed {
                    if !proposal.strategy.is_some() {
                        panic_with_error!(&env, Error::StrategyNotRegistered);
                    }
                    Self::deallocate_internal(
                        &env,
                        proposal.strategy.clone().unwrap(),
                        proposal.amount,
                    );
                }
            },
        }

        // A disbursement proposal is no longer approved-but-unpaid once it has
        // executed; drop it from the committed obligation that the liquidity
        // buffer must cover.
        Self::release_commitment(&env, proposal.kind.clone(), proposal.amount);

        // Persist updated proposal (executed flag already set)
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        Self::extend_persistent(&env, &DataKey::Proposal(proposal_id));

        // Update finalized status to Executed
        env.storage()
            .persistent()
            .set(&DataKey::FinalizedProposal(proposal_id), &ProposalStatus::Executed);
        Self::extend_persistent(&env, &DataKey::FinalizedProposal(proposal_id));

        ProposalExecuted {
            proposal_id,
            passed,
            amount: if passed
                && (proposal.kind == ProposalKind::Disbursement
                    || proposal.kind == ProposalKind::Allocation
                    || proposal.kind == ProposalKind::Deallocation)
            {
                proposal.amount
            } else {
                0
            },
        }
        .publish(&env);
    }

    pub fn cancel_proposal(env: Env, proposal_id: u32) {
        Self::assert_initialized(&env);
        let admin = Self::admin(&env);
        admin.require_auth();

        let mut proposal = env
            .storage()
            .persistent()
            .get::<_, Proposal>(&DataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::ProposalNotFound));

        if proposal.executed {
            panic_with_error!(&env, Error::ProposalAlreadyExecuted);
        }

        // Determine current public status
        let status = Self::proposal_status(&env, &proposal);
        if status == ProposalStatus::Rejected || status == ProposalStatus::Executed {
            panic_with_error!(&env, Error::ProposalAlreadyExecuted);
        }
        // Allow cancellation during Pending (before deadline) or Queued (after finalize)
        if status == ProposalStatus::Pending && env.ledger().sequence() > proposal.deadline_ledger {
            panic_with_error!(&env, Error::VotingClosed);
        }

        proposal.cancelled = true;

        // If the proposal was approved-but-unpaid (Queued), cancelling it
        // releases the committed obligation the liquidity buffer must cover.
        if status == ProposalStatus::Queued || status == ProposalStatus::Approved {
            Self::release_commitment(&env, proposal.kind.clone(), proposal.amount);
        }

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        Self::extend_persistent(&env, &DataKey::Proposal(proposal_id));

        ProposalCancelled {
            proposal_id,
            cancelled_by: admin,
        }
        .publish(&env);
    }

    pub fn get_balance(env: Env) -> i128 {
        env.storage()
            .instance()
            .get::<_, i128>(&TOTAL_KEY)
            .unwrap_or(0)
    }

    /// Idle USDC balance not committed to any strategy. This is what
    /// `get_balance` has always meant (the disbursable idle balance), so it is
    /// preserved and an explicit `get_idle` alias is provided.
    pub fn get_idle(env: Env) -> i128 {
        Self::get_balance(env.clone())
    }

    /// Outstanding principal at risk in the registered strategy (atomic units),
    /// excluding unrealized yield held at the strategy.
    pub fn get_allocated(env: Env) -> i128 {
        Self::allocated_principal(&env)
    }

    /// Unrealized yield currently held at the strategy, not yet harvested.
    /// Clamped at zero (a negative value means the strategy is impaired).
    pub fn get_accrued_yield(env: Env) -> i128 {
        let v = env
            .storage()
            .instance()
            .get::<_, i128>(&ALLOC_YIELD_KEY)
            .unwrap_or(0);
        if v < 0 {
            0
        } else {
            v
        }
    }

    /// Recognized impairment (loss) at the strategy, reported as a non-negative
    /// figure so `get_total_value` can be reconciled with principal + yield.
    pub fn get_impairment(env: Env) -> i128 {
        let v = env
            .storage()
            .instance()
            .get::<_, i128>(&ALLOC_YIELD_KEY)
            .unwrap_or(0);
        if v < 0 {
            -v
        } else {
            0
        }
    }

    /// Cumulative yield recognized into the treasury since inception
    /// (reporting accessor; harvested yield accrues to `TOTAL_KEY` and is
    /// disbursable like any idle balance).
    pub fn get_total_yield(env: Env) -> i128 {
        env.storage()
            .instance()
            .get::<_, i128>(&TOTAL_YIELD_KEY)
            .unwrap_or(0)
    }

    /// Total treasury value: idle + outstanding total at the strategy
    /// (principal + unrealized yield). This is mark-to-market value, against
    /// which the allocation cap is computed.
    /// Register the strategy adapter. Admin-only. This only names the venue;
    /// funds still move only via an executed governance proposal.
    pub fn set_strategy(env: Env, strategy: Address) {
        Self::assert_initialized(&env);
        let admin = Self::admin(&env);
        admin.require_auth();
        env.storage().instance().set(&STRATEGY_KEY, &strategy);
    }

    pub fn get_strategy(env: Env) -> Option<Address> {
        env.storage().instance().get(&STRATEGY_KEY)
    }

    /// Governance-set ceiling (in basis points) on the share of total treasury
    /// value at risk. Enforced on every allocation. Admin only.
    pub fn set_max_allocation_bps(env: Env, bps: u32) {
        Self::assert_initialized(&env);
        let admin = Self::admin(&env);
        admin.require_auth();
        if bps > 10_000 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        env.storage().instance().set(&MAX_ALLOC_BPS_KEY, &bps);
    }

    pub fn get_max_allocation_bps(env: Env) -> u32 {
        env.storage()
            .instance()
            .get::<_, u32>(&MAX_ALLOC_BPS_KEY)
            .unwrap_or(DEFAULT_MAX_ALLOC_BPS)
    }

    /// Liquidity-buffer margin (in basis points) that must remain idle on top
    /// of all approved-but-unpaid proposals. Admin only.
    pub fn set_liquidity_buffer_bps(env: Env, bps: u32) {
        Self::assert_initialized(&env);
        let admin = Self::admin(&env);
        admin.require_auth();
        if bps > 10_000 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        env.storage().instance().set(&LIQ_BUFFER_BPS_KEY, &bps);
    }

    pub fn get_liquidity_buffer_bps(env: Env) -> u32 {
        env.storage()
            .instance()
            .get::<_, u32>(&LIQ_BUFFER_BPS_KEY)
            .unwrap_or(DEFAULT_LIQUIDITY_BUFFER_BPS)
    }

    /// Total treasury value: idle + outstanding total at the strategy.
    /// Mark-to-market value, against which the allocation cap is computed.
    pub fn get_total_value(env: Env) -> i128 {
        let idle = env
            .storage()
            .instance()
            .get::<_, i128>(&TOTAL_KEY)
            .unwrap_or(0);
        let at_strategy = Self::strategy_total(&env);
        Self::checked_add_i128(&env, idle, at_strategy)
    }

    /// Current strategy position: (principal, unrealized_yield, max_withdrawable).
    pub fn get_position(env: Env) -> (i128, i128, i128) {
        let strategy = env
            .storage()
            .instance()
            .get::<_, Address>(&STRATEGY_KEY);
        if !strategy.is_some() {
            return (0, 0, 0);
        }
        let addr = strategy.unwrap();
        let principal = Self::allocated_principal(&env);
        let yield_ = env
            .storage()
            .instance()
            .get::<_, i128>(&ALLOC_YIELD_KEY)
            .unwrap_or(0);
        let max = Self::strategy_max_withdrawable(&env, &addr);
        (principal, yield_, max)
    }

    /// Harvest currently-unrealized strategy yield into the treasury.
    /// Admin-only. Rounding always favours the treasury.
    pub fn harvest(env: Env) {
        Self::assert_initialized(&env);
        let admin = Self::admin(&env);
        admin.require_auth();

        let strategy = env
            .storage()
            .instance()
            .get::<_, Address>(&STRATEGY_KEY)
            .unwrap_or_else(|| panic_with_error!(&env, Error::StrategyNotRegistered));

        // Accrued yield = reported value minus principal. If the strategy is
        // impaired (value below principal) there is nothing to harvest.
        let principal = Self::allocated_principal(&env);
        let balance = Self::strategy_total(&env);
        if balance <= principal {
            let _ = strategy;
            return;
        }
        let yield_amount = balance - principal;

        let returned = Self::strategy_withdraw(&env, &strategy, yield_amount);
        if returned < 0 {
            panic_with_error!(&env, Error::ArithmeticOverflow);
        }

        Self::apply_strategy_returns(&env, returned);

        // Realized yield is tracked for reporting and is disbursable like any
        // idle balance (apply_strategy_returns already credited it to idle).
        let total_yield = env
            .storage()
            .instance()
            .get::<_, i128>(&TOTAL_YIELD_KEY)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&TOTAL_YIELD_KEY, &Self::checked_add_i128(&env, total_yield, returned));

        Harvested {
            strategy,
            amount: returned,
            yield_amount: returned,
        }
        .publish(&env);
    }

    /// Pull everything recoverable from the strategy back to idle, callable by
    /// the pause authority without waiting for the timelock, and while paused.
    /// Losing unrealized yield is acceptable; being unable to exit is not.
    pub fn emergency_withdraw(env: Env, strategy: Address) {
        Self::assert_initialized(&env);

        let admin = Self::admin(&env);
        admin.require_auth();

        let registered = env
            .storage()
            .instance()
            .get::<_, Address>(&STRATEGY_KEY);
        if !registered.is_some() || registered.unwrap() != strategy {
            panic_with_error!(&env, Error::UnknownStrategy);
        }

        // Ask the strategy to return everything it can (max_withdrawable).
        let max = Self::strategy_max_withdrawable(&env, &strategy);
        let returned = if max <= 0 {
            0
        } else {
            let r = Self::strategy_withdraw(&env, &strategy, max);
            if r < 0 {
                panic_with_error!(&env, Error::ArithmeticOverflow);
            }
            r
        };

        // Reconcile accounting to the strategy's current reported balance. If
        // the venue returned nothing or the position is fully impaired, this
        // writes principal/yield down to match balance_of so `get_total_value`
        // reflects the loss without panicking.
        Self::apply_strategy_returns(&env, returned);

        EmergencyWithdrawal {
            strategy,
            amount: returned,
        }
        .publish(&env);
    }

    pub fn get_total_disbursed(env: Env) -> i128 {
        env.storage()
            .instance()
            .get::<_, i128>(&DISBURSED_KEY)
            .unwrap_or(0)
    }

    pub fn get_exchange_rate(_env: Env) -> i128 {
        GOV_PER_USDC
    }

    pub fn get_scholars_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get::<_, u32>(&SCHOLARS_KEY)
            .unwrap_or(0)
    }

    pub fn get_donors_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get::<_, u32>(&DONORS_KEY)
            .unwrap_or(0)
    }

    pub fn get_donor_total(env: Env, donor: Address) -> i128 {
        env.storage()
            .persistent()
            .get::<_, i128>(&DataKey::Donor(donor))
            .unwrap_or(0)
    }

    /// Admin-only: add an asset to the supported assets list for deposits.
    pub fn add_supported_asset(env: Env, asset: Address) {
        let admin = Self::admin(&env);
        admin.require_auth();

        let mut assets: Vec<Address> = env
            .storage()
            .instance()
            .get(&SUPPORTED_ASSETS_KEY)
            .unwrap_or(Vec::new(&env));

        if !assets.contains(&asset) {
            assets.push_back(asset);
            env.storage().instance().set(&SUPPORTED_ASSETS_KEY, &assets);
        }
        Self::extend_instance(&env);
    }

    /// Returns the list of token addresses accepted for deposits.
    pub fn get_supported_assets(env: Env) -> Vec<Address> {
        Self::extend_instance(&env);
        env.storage()
            .instance()
            .get::<_, Vec<Address>>(&SUPPORTED_ASSETS_KEY)
            .unwrap_or(Vec::new(&env))
    }

    /// Returns the cumulative amount deposited for a given asset (in atomic units).
    pub fn get_asset_deposited(env: Env, asset: Address) -> i128 {
        env.storage()
            .persistent()
            .get::<_, i128>(&DataKey::AssetDeposited(asset))
            .unwrap_or(0)
    }

    pub fn set_min_lrn_to_propose(env: Env, admin: Address, min_lrn: i128) {
        Self::assert_initialized(&env);

        admin.require_auth();
        if admin != Self::admin(&env) {
            panic_with_error!(&env, Error::Unauthorized);
        }
        if min_lrn < 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        env.storage()
            .instance()
            .set(&MIN_LRN_TO_PROPOSE_KEY, &min_lrn);
    }

    pub fn get_min_lrn_to_propose(env: Env) -> i128 {
        env.storage()
            .instance()
            .get::<_, i128>(&MIN_LRN_TO_PROPOSE_KEY)
            .unwrap_or(0)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn submit_proposal(
        env: Env,
        applicant: Address,
        amount: i128,
        program_name: String,
        program_url: String,
        program_description: String,
        start_date: String,
        milestone_titles: Vec<String>,
        milestone_dates: Vec<String>,
    ) -> u32 {
        Self::assert_initialized(&env);
        Self::assert_not_paused(&env);

        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let required_milestones = env
            .storage()
            .instance()
            .get::<_, u32>(&MILESTONE_COUNT_KEY)
            .unwrap_or(3);
        if milestone_titles.len() != required_milestones
            || milestone_dates.len() != required_milestones
        {
            panic_with_error!(&env, Error::InvalidMilestoneCount);
        }

        applicant.require_auth();

        let gov_contract = Self::governance_contract(&env);
        let gov_client = governance::client(&env, &gov_contract);
        let min_lrn_to_propose = Self::get_min_lrn_to_propose(env.clone());
        if gov_client.balance(&applicant) < min_lrn_to_propose {
            panic_with_error!(&env, Error::InsufficientReputation);
        }

        let proposal_id = env
            .storage()
            .instance()
            .get::<_, u32>(&NEXT_PROPOSAL_KEY)
            .unwrap_or(1);

        let proposal = Proposal {
            id: proposal_id,
            applicant: applicant.clone(),
            amount,
            program_name,
            program_url,
            program_description,
            start_date,
            milestone_titles,
            milestone_dates,
            submitted_at: env.ledger().timestamp(),
            yes_votes: 0,
            no_votes: 0,
            deadline_ledger: Self::checked_add_u32(
                &env,
                env.ledger().sequence(),
                Self::get_voting_period(env.clone()),
            ),
            executed: false,
            cancelled: false,
            kind: ProposalKind::Disbursement,
            strategy: None,
            new_quorum: 0,
            new_approval_bps: 0,
            new_voting_period: 0,
            queued_at: 0,
            veto_votes: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        
        Self::extend_persistent(&env, &DataKey::Proposal(proposal_id));

        Self::extend_persistent(&env, &DataKey::Proposal(proposal_id));

        let applicant_key = DataKey::ApplicantProposals(applicant.clone());
        let mut proposal_ids = env
            .storage()
            .persistent()
            .get::<_, Vec<u32>>(&applicant_key)
            .unwrap_or(Vec::new(&env));
        proposal_ids.push_back(proposal_id);
        env.storage()
            .persistent()
            .set(&applicant_key, &proposal_ids);

        Self::extend_persistent(&env, &applicant_key);
        let next_proposal_id = Self::checked_add_u32(&env, proposal_id, 1);
        env.storage()
            .instance()
            .set(&NEXT_PROPOSAL_KEY, &next_proposal_id);

        ProposalSubmitted {
            applicant,
            proposal_id,
            amount,
        }
        .publish(&env);

        proposal_id
    }

    /// Submit an allocation proposal (move `amount` of idle USDC into the
    /// strategy). Like every other proposal it must pass the vote, be
    /// finalized, and clear the timelock before `execute_proposal` moves funds.
    pub fn submit_allocation_proposal(env: Env, proposer: Address, strategy: Address, amount: i128) -> u32 {
        Self::assert_initialized(&env);
        Self::assert_not_paused(&env);
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        proposer.require_auth();
        // The proposer must hold minimum governance reputation, mirroring
        // submit_proposal, so spam is bounded.
        let gov_contract = Self::governance_contract(&env);
        let gov_client = governance::client(&env, &gov_contract);
        let min_lrn_to_propose = Self::get_min_lrn_to_propose(env.clone());
        if gov_client.balance(&proposer) < min_lrn_to_propose {
            panic_with_error!(&env, Error::InsufficientReputation);
        }

        let proposal_id = env
            .storage()
            .instance()
            .get::<_, u32>(&NEXT_PROPOSAL_KEY)
            .unwrap_or(1);

        let proposal = Proposal {
            id: proposal_id,
            applicant: proposer.clone(),
            amount,
            program_name: String::from_str(&env, "Strategy allocation"),
            program_url: String::from_str(&env, ""),
            program_description: String::from_str(&env, ""),
            start_date: String::from_str(&env, ""),
            milestone_titles: Vec::new(&env),
            milestone_dates: Vec::new(&env),
            submitted_at: env.ledger().timestamp(),
            yes_votes: 0,
            no_votes: 0,
            deadline_ledger: Self::checked_add_u32(
                &env,
                env.ledger().sequence(),
                Self::get_voting_period(env.clone()),
            ),
            executed: false,
            cancelled: false,
            kind: ProposalKind::Allocation,
            strategy: Some(strategy),
            new_quorum: 0,
            new_approval_bps: 0,
            new_voting_period: 0,
            queued_at: 0,
            veto_votes: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        Self::extend_persistent(&env, &DataKey::Proposal(proposal_id));

        let next_proposal_id = Self::checked_add_u32(&env, proposal_id, 1);
        env.storage()
            .instance()
            .set(&NEXT_PROPOSAL_KEY, &next_proposal_id);

        ProposalSubmitted {
            applicant: proposer,
            proposal_id,
            amount,
        }
        .publish(&env);

        proposal_id
    }

    /// Submit a deallocation proposal (withdraw `amount` from the strategy back
    /// to idle). Same governance pipeline as allocation.
    pub fn submit_deallocation_proposal(env: Env, proposer: Address, strategy: Address, amount: i128) -> u32 {
        Self::assert_initialized(&env);
        Self::assert_not_paused(&env);
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        proposer.require_auth();

        let gov_contract = Self::governance_contract(&env);
        let gov_client = governance::client(&env, &gov_contract);
        let min_lrn_to_propose = Self::get_min_lrn_to_propose(env.clone());
        if gov_client.balance(&proposer) < min_lrn_to_propose {
            panic_with_error!(&env, Error::InsufficientReputation);
        }

        let proposal_id = env
            .storage()
            .instance()
            .get::<_, u32>(&NEXT_PROPOSAL_KEY)
            .unwrap_or(1);

        let proposal = Proposal {
            id: proposal_id,
            applicant: proposer.clone(),
            amount,
            program_name: String::from_str(&env, "Strategy deallocation"),
            program_url: String::from_str(&env, ""),
            program_description: String::from_str(&env, ""),
            start_date: String::from_str(&env, ""),
            milestone_titles: Vec::new(&env),
            milestone_dates: Vec::new(&env),
            submitted_at: env.ledger().timestamp(),
            yes_votes: 0,
            no_votes: 0,
            deadline_ledger: Self::checked_add_u32(
                &env,
                env.ledger().sequence(),
                Self::get_voting_period(env.clone()),
            ),
            executed: false,
            cancelled: false,
            kind: ProposalKind::Deallocation,
            strategy: Some(strategy),
            new_quorum: 0,
            new_approval_bps: 0,
            new_voting_period: 0,
            queued_at: 0,
            veto_votes: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        Self::extend_persistent(&env, &DataKey::Proposal(proposal_id));

        let next_proposal_id = Self::checked_add_u32(&env, proposal_id, 1);
        env.storage()
            .instance()
            .set(&NEXT_PROPOSAL_KEY, &next_proposal_id);

        ProposalSubmitted {
            applicant: proposer,
            proposal_id,
            amount,
        }
        .publish(&env);

        proposal_id
    }

    pub fn get_proposal(env: Env, proposal_id: u32) -> Option<Proposal> {
        Self::extend_instance(&env);
        let key = DataKey::Proposal(proposal_id);
        if let Some(prop) = env.storage().persistent().get::<_, Proposal>(&key) {
            Self::extend_persistent(&env, &key);
            Some(prop)
        } else {
            None
        }
    }

    pub fn get_proposals_by_applicant(env: Env, applicant: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get::<_, Vec<u32>>(&DataKey::ApplicantProposals(applicant))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_proposals_by_status(env: Env, status: ProposalStatus) -> Vec<Proposal> {
        let proposal_count = Self::get_proposal_count(env.clone());
        let mut proposal_id = 1_u32;
        let mut proposals = Vec::new(&env);

        while proposal_id <= proposal_count {
            if let Some(proposal) = env
                .storage()
                .persistent()
                .get::<_, Proposal>(&DataKey::Proposal(proposal_id))
                .filter(|p| Self::proposal_status(&env, p) == status)
            {
                proposals.push_back(proposal);
            }
            if proposal_id == proposal_count {
                break;
            }
            proposal_id = Self::checked_add_u32(&env, proposal_id, 1);
        }

        proposals
    }

    pub fn get_active_proposals(env: Env) -> Vec<Proposal> {
        Self::get_proposals_by_status(env, ProposalStatus::Pending)
    }

    pub fn get_proposal_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get::<_, u32>(&NEXT_PROPOSAL_KEY)
            .unwrap_or(1)
            .saturating_sub(1)
    }

    pub fn vote(env: Env, voter: Address, proposal_id: u32, support: bool) {
        Self::assert_initialized(&env);
        Self::assert_not_paused(&env);

        // 1. Require auth
        voter.require_auth();

        // 2. Load proposal — panic ProposalNotFound if missing
        let mut proposal = env
            .storage()
            .persistent()
            .get::<_, Proposal>(&DataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::ProposalNotFound));

        if proposal.cancelled {
            panic_with_error!(&env, Error::ProposalCancelled);
        }

        if proposal.executed {
            panic_with_error!(&env, Error::ProposalAlreadyExecuted);
        }

        // 3. Panic VotingClosed if past deadline
        if env.ledger().sequence() > proposal.deadline_ledger {
            panic_with_error!(&env, Error::VotingClosed);
        }

        // 4. Panic AlreadyVoted if VoteCast(proposal_id, voter) exists
        let vote_key = DataKey::VoteCast(proposal_id, voter.clone());
        if env
            .storage()
            .persistent()
            .get::<_, bool>(&vote_key)
            .unwrap_or(false)
        {
            panic_with_error!(&env, Error::AlreadyVoted);
        }

        // 5. Get voter's GOV token balance as weight
        let gov_contract = Self::governance_contract(&env);
        let gov_client = governance::client(&env, &gov_contract);
        let weight = gov_client.get_voting_power(&voter);
        if weight < 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        // Weight of 0 is permitted; vote is recorded but has no numerical effect on outcome

        // 6. Add weight to yes_votes or no_votes
        if support {
            proposal.yes_votes = Self::checked_add_i128(&env, proposal.yes_votes, weight);
        } else {
            proposal.no_votes = Self::checked_add_i128(&env, proposal.no_votes, weight);
        }

        // 7. Mark VoteCast = true
        env.storage().persistent().set(&vote_key, &true);

        // 8. Update stored proposal
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        Self::extend_persistent(&env, &vote_key);
        Self::extend_persistent(&env, &DataKey::Proposal(proposal_id));

        // 9. Emit event
        VoteCastEvent {
            voter,
            proposal_id,
            support,
            weight,
        }
        .publish(&env);
    }

    /// Finalize a proposal once its voting deadline has passed.
    ///
    /// Only the admin may call this. The outcome is:
    /// - **Rejected** if total votes cast < MIN_QUORUM_BPS of total GOV supply.
    /// - **Approved** if quorum is met and `yes_votes > no_votes`.
    /// - **Rejected** otherwise (tie or majority against).
    ///
    /// The result is stored under `DataKey::FinalizedProposal(proposal_id)` so
    /// it can be read back without re-running the tally.
    pub fn finalize_proposal(env: Env, admin: Address, proposal_id: u32) -> ProposalStatus {
        admin.require_auth();
        let stored_admin = Self::admin(&env);
        if admin != stored_admin {
            panic_with_error!(&env, Error::Unauthorized);
        }

        let proposal = env
            .storage()
            .persistent()
            .get::<_, Proposal>(&DataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::ProposalNotFound));

        // Must be called after the voting deadline
        if env.ledger().sequence() <= proposal.deadline_ledger {
            panic_with_error!(&env, Error::VotingNotClosed);
        }

        let total_votes = Self::checked_add_i128(&env, proposal.yes_votes, proposal.no_votes);
        let quorum_threshold = Self::get_quorum(env.clone());
        let approval_bps = Self::get_approval_bps(env.clone());

        let passed = total_votes >= quorum_threshold
            && total_votes > 0
            && proposal
                .yes_votes
                .checked_mul(10_000)
                .map(|v| (v / total_votes) as u32 > approval_bps)
                .unwrap_or(false);

        let mut proposal = env
            .storage()
            .persistent()
            .get::<_, Proposal>(&DataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::ProposalNotFound));

        // Idempotency guard for the committed obligation: only count the
        // proposal's amount the first time it transitions to an approved state.
        let exists = env
            .storage()
            .persistent()
            .get::<_, ProposalStatus>(&DataKey::FinalizedProposal(proposal_id));
        let was_already_approved = exists == Some(ProposalStatus::Queued)
            || exists == Some(ProposalStatus::Approved);

        let status = if passed {
            let current_ledger = env.ledger().sequence();
            proposal.queued_at = current_ledger;
            env.storage()
                .persistent()
                .set(&DataKey::Proposal(proposal_id), &proposal);
            Self::extend_persistent(&env, &DataKey::Proposal(proposal_id));

            let timelock_delay = Self::get_timelock_delay(env.clone());
            let execution_ready_at = Self::checked_add_u32(&env, current_ledger, timelock_delay);

            if !was_already_approved {
                Self::commit_proposal(&env, proposal.kind.clone(), proposal.amount);
            }

            ProposalQueued {
                proposal_id,
                queued_at: current_ledger,
                execution_ready_at,
            }
            .publish(&env);

            ProposalStatus::Queued
        } else {
            ProposalStatus::Rejected
        };

        env.storage()
            .persistent()
            .set(&DataKey::FinalizedProposal(proposal_id), &status.clone());
        
        Self::extend_persistent(&env, &DataKey::FinalizedProposal(proposal_id));

        Self::extend_persistent(&env, &DataKey::FinalizedProposal(proposal_id));

        status
    }

    /// Returns the finalized status for a proposal if `finalize_proposal` has
    /// been called, or `None` if it hasn't been finalized yet.
    pub fn get_finalized_status(env: Env, proposal_id: u32) -> Option<ProposalStatus> {
        env.storage()
            .persistent()
            .get::<_, ProposalStatus>(&DataKey::FinalizedProposal(proposal_id))
    }

    /// Register an objection to a queued proposal.
    ///
    /// Voters can object during the timelock period. Objections accumulate
    /// in `proposal.veto_votes`. If veto votes reach a 2/3 supermajority of
    /// total GOV supply, anyone can call `veto_proposal` to reject it.
    pub fn object_to_proposal(env: Env, voter: Address, proposal_id: u32) {
        Self::assert_initialized(&env);
        Self::assert_not_paused(&env);

        voter.require_auth();

        let mut proposal = env
            .storage()
            .persistent()
            .get::<_, Proposal>(&DataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::ProposalNotFound));

        if proposal.cancelled {
            panic_with_error!(&env, Error::ProposalCancelled);
        }

        if proposal.executed {
            panic_with_error!(&env, Error::ProposalAlreadyExecuted);
        }

        let finalized_status = env
            .storage()
            .persistent()
            .get::<_, ProposalStatus>(&DataKey::FinalizedProposal(proposal_id));
        if finalized_status != Some(ProposalStatus::Queued) {
            panic_with_error!(&env, Error::NotQueued);
        }

        let veto_key = DataKey::VetoCast(proposal_id, voter.clone());
        if env
            .storage()
            .persistent()
            .get::<_, bool>(&veto_key)
            .unwrap_or(false)
        {
            panic_with_error!(&env, Error::AlreadyVoted);
        }

        let gov_contract = Self::governance_contract(&env);
        let gov_client = governance::client(&env, &gov_contract);
        let weight = gov_client.get_voting_power(&voter);
        if weight < 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        proposal.veto_votes = Self::checked_add_i128(&env, proposal.veto_votes, weight);
        env.storage().persistent().set(&veto_key, &true);
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        Self::extend_persistent(&env, &veto_key);
        Self::extend_persistent(&env, &DataKey::Proposal(proposal_id));
    }

    /// Veto a queued proposal.
    ///
    /// Either the admin may veto directly, or any caller may veto if the
    /// accumulated `veto_votes` represent a 2/3 supermajority of the total GOV
    /// token supply.
    pub fn veto_proposal(env: Env, caller: Address, proposal_id: u32) {
        caller.require_auth();

        let proposal = env
            .storage()
            .persistent()
            .get::<_, Proposal>(&DataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::ProposalNotFound));

        if proposal.cancelled || proposal.executed {
            panic_with_error!(&env, Error::ProposalAlreadyExecuted);
        }

        let finalized_status = env
            .storage()
            .persistent()
            .get::<_, ProposalStatus>(&DataKey::FinalizedProposal(proposal_id));
        if finalized_status != Some(ProposalStatus::Queued) {
            panic_with_error!(&env, Error::NotQueued);
        }

        let admin = Self::admin(&env);
        let is_admin = caller == admin;
        let total_gov = Self::get_total_gov_issued(env.clone());
        // 2/3 supermajority threshold (multiply by 2, divide by 3)
        let supermajority_met = total_gov > 0
            && proposal.veto_votes >= (total_gov * 2) / 3;

        if !is_admin && !supermajority_met {
            panic_with_error!(&env, Error::VetoNotMet);
        }

        // The proposal was approved-but-unpaid; vetoing it releases the
        // committed obligation that the liquidity buffer must cover.
        Self::release_commitment(&env, proposal.kind.clone(), proposal.amount);

        env.storage()
            .persistent()
            .set(
                &DataKey::FinalizedProposal(proposal_id),
                &ProposalStatus::Rejected,
            );
        Self::extend_persistent(&env, &DataKey::FinalizedProposal(proposal_id));

        ProposalCancelled {
            proposal_id,
            cancelled_by: caller,
        }
        .publish(&env);
    }

    /// Returns the total GOV tokens issued so far (used for quorum calculation).
    pub fn get_total_gov_issued(env: Env) -> i128 {
        env.storage()
            .instance()
            .get::<_, i128>(&TOTAL_GOV_KEY)
            .unwrap_or(0)
    }

    fn governance_contract(env: &Env) -> Address {
        if let Some(governance) = env.storage().instance().get::<_, Address>(&GOV_KEY) {
            governance
        } else {
            panic_with_error!(env, Error::NotInitialized);
        }
    }

    fn assert_initialized(env: &Env) {
        if !env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(env, Error::NotInitialized);
        }
    }

    fn assert_not_paused(env: &Env) {
        let paused: bool = env.storage().instance().get(&PAUSED_KEY).unwrap_or(false);
        if paused {
            panic_with_error!(env, Error::ContractPaused);
        }
    }

    fn proposal_status(env: &Env, proposal: &Proposal) -> ProposalStatus {
        if proposal.cancelled {
            return ProposalStatus::Rejected;
        }

        // If finalize_proposal has already been called, return its stored result
        // authoritatively — this is the single source of truth.
        if let Some(status) = env
            .storage()
            .persistent()
            .get::<_, ProposalStatus>(&DataKey::FinalizedProposal(proposal.id))
        {
            return match status {
                // Legacy pre-timelock: Approved proposals become Queued or Executed
                ProposalStatus::Approved => {
                    if proposal.executed {
                        ProposalStatus::Executed
                    } else {
                        ProposalStatus::Queued
                    }
                }
                s => s,
            };
        }

        if env.ledger().sequence() <= proposal.deadline_ledger {
            ProposalStatus::Pending
        } else {
            // Apply the same quorum + approval_bps formula used in finalize_proposal
            // and execute_proposal so all code paths are consistent.
            let total_votes = proposal
                .yes_votes
                .checked_add(proposal.no_votes)
                .unwrap_or(i128::MAX);
            let quorum_threshold = env
                .storage()
                .instance()
                .get::<_, i128>(&QUORUM_KEY)
                .unwrap_or(0);
            let approval_bps = env
                .storage()
                .instance()
                .get::<_, u32>(&APPROVAL_BPS_KEY)
                .unwrap_or(0);

            let passed = total_votes >= quorum_threshold
                && total_votes > 0
                && proposal
                    .yes_votes
                    .checked_mul(10_000)
                    .map(|v| (v / total_votes) as u32 > approval_bps)
                    .unwrap_or(false);

            if passed {
                ProposalStatus::Queued
            } else {
                ProposalStatus::Rejected
            }
        }
    }

    fn disburse_internal(env: &Env, recipient: &Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(env, Error::InvalidAmount);
        }

        let total = env
            .storage()
            .instance()
            .get::<_, i128>(&TOTAL_KEY)
            .unwrap_or(0);
        if amount > total {
            panic_with_error!(env, Error::InsufficientFunds);
        }

        let new_total = Self::checked_sub_i128(env, total, amount);
        env.storage().instance().set(&TOTAL_KEY, &new_total);

        let disbursed = env
            .storage()
            .instance()
            .get::<_, i128>(&DISBURSED_KEY)
            .unwrap_or(0);
        let new_disbursed = Self::checked_add_i128(env, disbursed, amount);
        env.storage().instance().set(&DISBURSED_KEY, &new_disbursed);

        let scholar_key = DataKey::Scholar(recipient.clone());
        if !env.storage().persistent().has(&scholar_key) {
            let scholars_count = env
                .storage()
                .instance()
                .get::<_, u32>(&SCHOLARS_KEY)
                .unwrap_or(0);
            let new_scholars_count = Self::checked_add_u32(env, scholars_count, 1);
            env.storage()
                .instance()
                .set(&SCHOLARS_KEY, &new_scholars_count);
            env.storage().persistent().set(&scholar_key, &true);
            Self::extend_persistent(env, &scholar_key);
        }

        token::client(env).transfer(&env.current_contract_address(), recipient, &amount);

        DisbursementRecorded {
            recipient: recipient.clone(),
            amount,
        }
        .publish(env);
    }

    fn admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&ADMIN_KEY)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    /// Replace the current contract WASM with a new uploaded hash. Admin only.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        Self::assert_initialized(&env);
        Self::extend_instance(&env);
        let admin = Self::admin(&env);
        admin.require_auth();
        upgrade::apply(&env, &admin, &new_wasm_hash);
    }

    pub fn get_version(env: Env) -> String {
        String::from_str(&env, "1.0.0")
    }

    // -------------------------------------------------------------------------
    // Yield strategy internals (invoked only from executed governance props)
    // -------------------------------------------------------------------------

    /// Internal allocation. Called only from `execute_proposal` for an
    /// executed `Allocation` proposal. Moves idle USDC into the strategy and
    /// enforces both the cap and the liquidity buffer.
    fn allocate_internal(env: &Env, strategy: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(env, Error::InvalidAmount);
        }
        let registered = env
            .storage()
            .instance()
            .get::<_, Address>(&STRATEGY_KEY);
        if !registered.is_some() || registered.unwrap() != strategy {
            panic_with_error!(env, Error::UnknownStrategy);
        }

        let idle = env
            .storage()
            .instance()
            .get::<_, i128>(&TOTAL_KEY)
            .unwrap_or(0);
        if amount > idle {
            panic_with_error!(env, Error::InsufficientFunds);
        }

        // 1) Allocation cap: current outstanding + amount must not exceed
        //    max_allocation_bps of total treasury value. Rounding always
        //    favours the treasury (floor the allowed amount).
        let outstanding = Self::strategy_total(env);
        let cap_bps: u128 = Self::get_max_allocation_bps(env.clone()) as u128;
        let total_value = Self::checked_add_i128(env, idle, outstanding);
        let allowed_cap = total_value.checked_mul(cap_bps as i128).unwrap_or(0) / 10_000;
        if outstanding + amount > allowed_cap {
            panic_with_error!(env, Error::AllocationCapExceeded);
        }

        // 2) Liquidity buffer: post-allocation idle must cover approved-but-
        //    unpaid proposals plus their margin. Allocating below this floor
        //    is rejected so an approved scholarship can never be blocked.
        let committed = Self::approved_unpaid_total(env);
        let buffer_bps: u128 = Self::get_liquidity_buffer_bps(env.clone()) as u128;
        let required_idle = committed.checked_mul((10_000 + buffer_bps) as i128).unwrap_or(0) / 10_000;
        if idle - amount < required_idle {
            panic_with_error!(env, Error::LiquidityBufferBreached);
        }

        // 3) Move funds to the strategy and record principal.
        let usdc = env
            .storage()
            .instance()
            .get::<_, Address>(&USDC_KEY)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
        soroban_sdk::token::TokenClient::new(env, &usdc)
            .transfer(&env.current_contract_address(), &strategy, &amount);
        strategy::client(env, &strategy).deposit(&amount);

        let current_principal = env
            .storage()
            .instance()
            .get::<_, i128>(&ALLOC_PRINCIPAL_KEY)
            .unwrap_or(0);
        let new_principal = Self::checked_add_i128(env, current_principal, amount);
        env.storage()
            .instance()
            .set(&ALLOC_PRINCIPAL_KEY, &new_principal);

        // Decrement idle
        let new_idle = Self::checked_sub_i128(env, idle, amount);
        env.storage().instance().set(&TOTAL_KEY, &new_idle);

        Allocated {
            strategy,
            amount,
        }
        .publish(env);
    }

    /// Internal deallocation. Called only from `execute_proposal` for an
    /// executed `Deallocation` proposal. Withdraws from the strategy and
    /// writes the returned capital back to idle. Loss is represented without
    /// panicking.
    fn deallocate_internal(env: &Env, strategy: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(env, Error::InvalidAmount);
        }
        let registered = env
            .storage()
            .instance()
            .get::<_, Address>(&STRATEGY_KEY);
        if !registered.is_some() || registered.unwrap() != strategy {
            panic_with_error!(env, Error::UnknownStrategy);
        }

        let worth = Self::strategy_total(env);
        if amount > worth {
            panic_with_error!(env, Error::ExceedsAllocated);
        }

        // Withdraw the requested amount (or all recoverable if less remains),
        // returning capital to the treasury. Impaired yield / loss is captured
        // by writing back only what the strategy actually returns.
        let ask = if amount < worth { amount } else { worth };
        let returned = Self::strategy_withdraw(env, &strategy, ask);
        if returned < 0 {
            panic_with_error!(env, Error::ArithmeticOverflow);
        }

        Self::apply_strategy_returns(env, returned);

        Deallocated {
            strategy: strategy.clone(),
            amount: ask,
            returned,
        }
        .publish(env);
    }

    /// Sum of all approved-but-unpaid disbursement proposal amounts. This is
    /// the commitment the liquidity buffer must always cover with idle balance.
    /// Maintained as a running counter (see COMMITTED_KEY).
    fn approved_unpaid_total(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get::<_, i128>(&COMMITTED_KEY)
            .unwrap_or(0)
    }

    /// Add a just-approved disbursement proposal to the committed (approved-but
    /// -unpaid) total. Call site: finalize_proposal on transition to Queued /
    /// legacy Approved.
    fn commit_proposal(env: &Env, kind: ProposalKind, amount: i128) {
        if kind != ProposalKind::Disbursement || amount <= 0 {
            return;
        }
        let current = env
            .storage()
            .instance()
            .get::<_, i128>(&COMMITTED_KEY)
            .unwrap_or(0);
        let new_total = Self::checked_add_i128(env, current, amount);
        env.storage().instance().set(&COMMITTED_KEY, &new_total);
    }

    /// Remove a cancelled/vetoed/executed disbursement proposal from the
    /// committed obligation. Call sites: veto_proposal, cancel_proposal
    /// (on Queued), execute_proposal (after disbursing).
    fn release_commitment(env: &Env, kind: ProposalKind, amount: i128) {
        if kind != ProposalKind::Disbursement || amount <= 0 {
            return;
        }
        let current = env
            .storage()
            .instance()
            .get::<_, i128>(&COMMITTED_KEY)
            .unwrap_or(0);
        let new_total = Self::checked_sub_i128(env, current, amount);
        env.storage().instance().set(&COMMITTED_KEY, &new_total);
    }

    fn allocated_principal(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get::<_, i128>(&ALLOC_PRINCIPAL_KEY)
            .unwrap_or(0)
    }

    /// Total recoverable value at the strategy as currently reported
    /// (principal + unrealized yield).
    fn strategy_total(env: &Env) -> i128 {
        let strategy = env
            .storage()
            .instance()
            .get::<_, Address>(&STRATEGY_KEY);
        if !strategy.is_some() {
            return 0;
        }
        strategy::client(env, &strategy.unwrap()).balance_of()
    }

    fn strategy_max_withdrawable(env: &Env, addr: &Address) -> i128 {
        strategy::client(env, addr).max_withdrawable()
    }

    fn strategy_withdraw(env: &Env, addr: &Address, amount: i128) -> i128 {
        strategy::client(env, addr).withdraw(&amount, &env.current_contract_address())
    }

    /// Reflect the actual returned amount back into local accounting, writing
    /// down principal/yield for partial withdrawal or loss without panicking.
    /// The strategy's reported remaining balance is authoritative, so yield
    /// and any impairment are always consistent with `get_total_value`.
    /// Rounding always favours the treasury: principal is never written below
    /// zero, and a residual loss above principal is absorbed as negative yield.
    fn apply_strategy_returns(env: &Env, returned: i128) {
        // 1) Credit the returned funds back to idle balance.
        let idle = env
            .storage()
            .instance()
            .get::<_, i128>(&TOTAL_KEY)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&TOTAL_KEY, &Self::checked_add_i128(env, idle, returned));

        // 2) Re-split principal/yield from the strategy's remaining reported
        //    value, favouring the treasury (principal preserved first).
        let principal = Self::allocated_principal(env);
        let remaining = Self::strategy_total(env);
        let new_principal = if remaining < principal {
            remaining
        } else {
            principal
        };
        let new_yield = remaining - new_principal; // signed: negative => impairment
        env.storage().instance().set(&ALLOC_PRINCIPAL_KEY, &new_principal);
        env.storage().instance().set(&ALLOC_YIELD_KEY, &new_yield);
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

    fn checked_add_i128(env: &Env, left: i128, right: i128) -> i128 {
        left.checked_add(right)
            .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow))
    }

    fn checked_sub_i128(env: &Env, left: i128, right: i128) -> i128 {
        left.checked_sub(right)
            .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow))
    }

    fn checked_add_u32(env: &Env, left: u32, right: u32) -> u32 {
        left.checked_add(right)
            .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow))
    }
}

mod governance {
    use soroban_sdk::{Address, Env};

    pub fn client<'a>(env: &Env, contract_id: &Address) -> GovernanceTokenClient<'a> {
        GovernanceTokenClient::new(env, contract_id)
    }

    #[soroban_sdk::contractclient(name = "GovernanceTokenClient")]
    #[allow(dead_code)]
    pub trait GovernanceTokenInterface {
        fn mint(env: Env, to: Address, amount: i128);
        fn balance(env: Env, account: Address) -> i128;
        fn get_voting_power(env: Env, address: Address) -> i128;
    }
}

pub use governance::GovernanceTokenClient;

mod strategy {
    use soroban_sdk::{Address, Env};

    pub fn client<'a>(env: &Env, contract_id: &Address) -> StrategyClient<'a> {
        StrategyClient::new(env, contract_id)
    }

    // The adapter contract that venue funds are deposited into. The treasury is
    // never hard-wired to one venue: set_strategy names the adapter, and a new
    // venue can be swapped in without a treasury upgrade.
    #[soroban_sdk::contractclient(name = "StrategyClient")]
    #[allow(dead_code)]
    pub trait StrategyInterface {
        /// Record a deposit of `amount` atomic units from the treasury. The
        /// strategy is expected to have received the corresponding USDC.
        fn deposit(env: Env, amount: i128);
        /// Withdraw `amount` (or all that is recoverable) and transfer the
        /// returned funds to `to`. Returns the amount actually returned.
        fn withdraw(env: Env, amount: i128, to: Address) -> i128;
        /// Total recoverable value currently held at the strategy, marked to
        /// market including any accrued yield or impairment.
        fn balance_of(env: Env) -> i128;
        /// Maximum amount currently withdrawable from the strategy.
        fn max_withdrawable(env: Env) -> i128;
    }
}

pub use strategy::StrategyClient;

mod token {
    #[cfg(test)]
    mod test_token {
        use soroban_sdk::{Address, Env};

        use super::super::USDC_KEY;

        pub fn contract_id(env: &Env) -> Address {
            env.storage()
                .instance()
                .get::<_, Address>(&USDC_KEY)
                .expect("token contract not initialized")
        }

        pub fn register(env: &Env, admin: &Address) {
            let sac = env.register_stellar_asset_contract_v2(admin.clone());
            env.storage().instance().set(&USDC_KEY, &sac.address());
        }

        pub fn client<'a>(env: &Env) -> soroban_sdk::token::TokenClient<'a> {
            soroban_sdk::token::TokenClient::new(env, &contract_id(env))
        }
    }

    #[cfg(not(test))]
    pub fn client<'a>(env: &soroban_sdk::Env) -> soroban_sdk::token::TokenClient<'a> {
        let token_address = env
            .storage()
            .instance()
            .get::<_, soroban_sdk::Address>(&crate::USDC_KEY)
            .unwrap_or_else(|| soroban_sdk::panic_with_error!(env, crate::Error::NotInitialized));
        soroban_sdk::token::TokenClient::new(env, &token_address)
    }

    #[cfg(test)]
    pub use test_token::*;
}

#[cfg(test)]
mod test;

#[cfg(test)]
mod tests;
