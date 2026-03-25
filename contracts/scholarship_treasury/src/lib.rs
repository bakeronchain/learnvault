#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    symbol_short, Address, Env, String, Symbol, Vec,
};

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const GOV_KEY: Symbol = symbol_short!("GOV");
const USDC_KEY: Symbol = symbol_short!("USDC");
const TOTAL_KEY: Symbol = symbol_short!("TOTAL");
const NEXT_PROPOSAL_KEY: Symbol = symbol_short!("NEXTPROP");
const DISBURSED_KEY: Symbol = symbol_short!("DISBURSED");
const SCHOLARS_KEY: Symbol = symbol_short!("SCHOLARS");
const DONORS_KEY: Symbol = symbol_short!("DONORS");
const PAUSED_KEY: Symbol = symbol_short!("PAUSED");

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Donor(Address),
    Proposal(u32),
    ApplicantProposals(Address),
    Scholar(Address),
    VoteCast(u32, Address),   // (proposal_id, voter) -> bool
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
pub struct VoteCast {
    #[topic]
    pub voter: Address,
    #[topic]
    pub proposal_id: u32,
    pub support: bool,
    pub weight: i128,
}

#[contractimpl]
impl ScholarshipTreasury {
    pub fn initialize(env: Env, admin: Address, usdc_token: Address, governance_contract: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage().instance().set(&USDC_KEY, &usdc_token);
        env.storage().instance().set(&GOV_KEY, &governance_contract);
        env.storage().instance().set(&TOTAL_KEY, &0_i128);
        env.storage().instance().set(&NEXT_PROPOSAL_KEY, &1_u32);
        env.storage().instance().set(&DISBURSED_KEY, &0_i128);
        env.storage().instance().set(&SCHOLARS_KEY, &0_u32);
        env.storage().instance().set(&DONORS_KEY, &0_u32);
        env.storage().instance().set(&PAUSED_KEY, &false);
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
        usdc.transfer(&donor, &env.current_contract_address(), &amount);

        let gov_contract = Self::governance_contract(&env);
        let gov_client = governance::client(&env, &gov_contract);
        gov_client.mint(&donor, &amount);

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
        }

        DisbursementRecorded { recipient, amount }.publish(&env);
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

    pub fn donor_contribution(env: Env, donor: Address) -> i128 {
        Self::get_donor_total(env, donor)
    }

    pub fn treasury_balance(env: Env) -> i128 {
        Self::get_balance(env)
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
            deadline_ledger: env.ledger().sequence() + 7 * 17_280,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);

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
        env.storage()
            .persistent()
            .get::<_, Proposal>(&DataKey::Proposal(proposal_id))
    }

    pub fn get_proposals_by_applicant(env: Env, applicant: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get::<_, Vec<u32>>(&DataKey::ApplicantProposals(applicant))
            .unwrap_or(Vec::new(&env))
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
        let weight = gov_client.balance(&voter);
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

        // 9. Emit event
        VoteCast {
            voter,
            proposal_id,
            support,
            weight,
        }
        .publish(&env);
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

    fn admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&ADMIN_KEY)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }
}

mod governance {
    use soroban_sdk::{Address, Env};

    pub fn client<'a>(env: &Env, contract_id: &Address) -> GovernanceTokenClient<'a> {
        GovernanceTokenClient::new(env, contract_id)
    }

    #[soroban_sdk::contractclient(name = "GovernanceTokenClient")]
    pub trait GovernanceTokenInterface {
        fn mint(env: Env, to: Address, amount: i128);
        fn balance(env: Env, account: Address) -> i128;
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
