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
const GOV_PER_USDC: i128 = 100;
const PROPOSAL_DEADLINE_LEDGERS: u32 = 100_800;
const QUORUM_KEY: Symbol = symbol_short!("QUORUM");
const APPROVAL_BPS_KEY: Symbol = symbol_short!("APPBPS");

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Donor(Address),
    Proposal(u32),
    ApplicantProposals(Address),
    Scholar(Address),
    VoteCast(u32, Address), // (proposal_id, voter) -> bool
    FinalizedProposal(u32), // proposal_id -> ProposalStatus (set by finalize_proposal)
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
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ProposalStatus {
    Pending,
    Approved,
    Rejected,
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
}

#[contract]
pub struct ScholarshipTreasury;

#[contractevent(topics = ["deposit"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DepositRecorded {
    #[topic]
    pub donor: Address,
    pub amount: i128,
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

#[contractimpl]
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

        Self::validate_quorum_threshold(&env, quorum_threshold);
        if approval_bps > 10_000 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        env.storage().instance().set(&ADMIN_KEY, &admin);
        upgrade::init(&env);
        env.storage().instance().set(&USDC_KEY, &usdc_token);
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

        Self::extend_instance(&env);
    }

    /// Returns the configured quorum as an absolute minimum vote count.
    ///
    /// This is a hard threshold (not basis points), so proposals require
    /// `yes_votes + no_votes >= quorum_threshold` to be eligible to pass.
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

    pub fn set_quorum(env: Env, new_quorum: i128) {
        let admin = Self::admin(&env);
        admin.require_auth();
        Self::validate_quorum_threshold(&env, new_quorum);
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

    pub fn pause(env: Env) {
        let admin = Self::admin(&env);
        admin.require_auth();
        env.storage().instance().set(&PAUSED_KEY, &true);
    }

    pub fn unpause(env: Env) {
        let admin = Self::admin(&env);
        admin.require_auth();
        env.storage().instance().set(&PAUSED_KEY, &false);
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get::<_, bool>(&PAUSED_KEY)
            .unwrap_or(false)
    }

    pub fn deposit(env: Env, donor: Address, amount: i128) {
        Self::assert_not_paused(&env);

        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        donor.require_auth();

        let usdc = token::client(&env);
        usdc.transfer(&donor, env.current_contract_address(), &amount);

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
        env.storage()
            .instance()
            .set(&TOTAL_GOV_KEY, &(total_gov + gov_amount));

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
            env.storage()
                .instance()
                .set(&DONORS_KEY, &(donors_count + 1));
        }

        env.storage()
            .persistent()
            .set(&donor_key, &(current + amount));

        Self::extend_persistent(&env, &donor_key);

        let total = env
            .storage()
            .instance()
            .get::<_, i128>(&TOTAL_KEY)
            .unwrap_or(0);
        env.storage().instance().set(&TOTAL_KEY, &(total + amount));

        DepositRecorded { donor, amount }.publish(&env);
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

        token::client(&env).transfer(&env.current_contract_address(), &recipient, &amount);
        env.storage().instance().set(&TOTAL_KEY, &(total - amount));

        let disbursed = env
            .storage()
            .instance()
            .get::<_, i128>(&DISBURSED_KEY)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DISBURSED_KEY, &(disbursed + amount));

        let scholar_key = DataKey::Scholar(recipient.clone());
        if !env.storage().persistent().has(&scholar_key) {
            let scholars_count = env
                .storage()
                .instance()
                .get::<_, u32>(&SCHOLARS_KEY)
                .unwrap_or(0);
            env.storage()
                .instance()
                .set(&SCHOLARS_KEY, &(scholars_count + 1));
            env.storage().persistent().set(&scholar_key, &true);
            Self::extend_persistent(&env, &scholar_key);
        }

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

        if env.ledger().sequence() <= proposal.deadline_ledger {
            panic_with_error!(&env, Error::VotingNotClosed);
        }

        if proposal.executed {
            panic_with_error!(&env, Error::ProposalAlreadyExecuted);
        }

        let total_votes = proposal.yes_votes + proposal.no_votes;
        let quorum_threshold = Self::get_quorum(env.clone());
        let approval_bps = Self::get_approval_bps(env.clone());

        let passed = total_votes >= quorum_threshold
            && total_votes > 0
            && proposal
                .yes_votes
                .checked_mul(10_000)
                .map(|v| (v / total_votes) as u32 > approval_bps)
                .unwrap_or(false);

        if passed {
            Self::disburse_internal(&env, &proposal.applicant, proposal.amount);
        }

        proposal.executed = true;
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        Self::extend_persistent(&env, &DataKey::Proposal(proposal_id));

        ProposalExecuted {
            proposal_id,
            passed,
            amount: if passed { proposal.amount } else { 0 },
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

        if env.ledger().sequence() > proposal.deadline_ledger {
            panic_with_error!(&env, Error::VotingClosed);
        }

        if proposal.executed {
            panic_with_error!(&env, Error::ProposalAlreadyExecuted);
        }

        proposal.cancelled = true;
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

    /// Sets the minimum LRN (governance token) balance an applicant must hold to submit
    /// a proposal. The value must be **strictly positive**; use [`clear_min_lrn_to_propose`]
    /// to remove the requirement (same effect as the default: no minimum).
    pub fn set_min_lrn_to_propose(env: Env, admin: Address, min_lrn: i128) {
        Self::assert_initialized(&env);

        admin.require_auth();
        if admin != Self::admin(&env) {
            panic_with_error!(&env, Error::Unauthorized);
        }
        if min_lrn <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        env.storage()
            .instance()
            .set(&MIN_LRN_TO_PROPOSE_KEY, &min_lrn);
    }

    /// Removes the minimum LRN requirement so any holder can submit (subject to other
    /// proposal rules). This is the explicit admin path to "no minimum"; `set_min_lrn_to_propose(0)` is rejected.
    pub fn clear_min_lrn_to_propose(env: Env, admin: Address) {
        Self::assert_initialized(&env);

        admin.require_auth();
        if admin != Self::admin(&env) {
            panic_with_error!(&env, Error::Unauthorized);
        }

        env.storage().instance().remove(&MIN_LRN_TO_PROPOSE_KEY);
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

        if amount <= 0 || milestone_titles.len() != 3 || milestone_dates.len() != 3 {
            panic_with_error!(&env, Error::InvalidAmount);
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
            deadline_ledger: env.ledger().sequence() + PROPOSAL_DEADLINE_LEDGERS,
            executed: false,
            cancelled: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);

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
        env.storage()
            .instance()
            .set(&NEXT_PROPOSAL_KEY, &(proposal_id + 1));

        ProposalSubmitted {
            applicant,
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
            proposal_id += 1;
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
        // Weight of 0 is permitted; vote is recorded but has no numerical effect on outcome

        // 6. Add weight to yes_votes or no_votes
        if support {
            proposal.yes_votes += weight;
        } else {
            proposal.no_votes += weight;
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

        let total_votes = proposal.yes_votes + proposal.no_votes;
        let quorum_threshold = Self::get_quorum(env.clone());
        let approval_bps = Self::get_approval_bps(env.clone());

        let passed = total_votes >= quorum_threshold
            && total_votes > 0
            && proposal
                .yes_votes
                .checked_mul(10_000)
                .map(|v| (v / total_votes) as u32 > approval_bps)
                .unwrap_or(false);

        let status = if passed {
            ProposalStatus::Approved
        } else {
            ProposalStatus::Rejected
        };

        env.storage()
            .persistent()
            .set(&DataKey::FinalizedProposal(proposal_id), &status.clone());

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
        if env.ledger().sequence() <= proposal.deadline_ledger {
            ProposalStatus::Pending
        } else if proposal.yes_votes > proposal.no_votes {
            ProposalStatus::Approved
        } else {
            ProposalStatus::Rejected
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

        token::client(env).transfer(&env.current_contract_address(), recipient, &amount);
        env.storage().instance().set(&TOTAL_KEY, &(total - amount));

        let disbursed = env
            .storage()
            .instance()
            .get::<_, i128>(&DISBURSED_KEY)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DISBURSED_KEY, &(disbursed + amount));

        let scholar_key = DataKey::Scholar(recipient.clone());
        if !env.storage().persistent().has(&scholar_key) {
            let scholars_count = env
                .storage()
                .instance()
                .get::<_, u32>(&SCHOLARS_KEY)
                .unwrap_or(0);
            env.storage()
                .instance()
                .set(&SCHOLARS_KEY, &(scholars_count + 1));
            env.storage().persistent().set(&scholar_key, &true);
            Self::extend_persistent(env, &scholar_key);
        }

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

    fn validate_quorum_threshold(env: &Env, quorum_threshold: i128) {
        // Quorum is an absolute vote-count floor, so it must be strictly positive.
        if quorum_threshold <= 0 {
            panic_with_error!(env, Error::InvalidAmount);
        }
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
