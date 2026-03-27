#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    Address, Env, String, Symbol, Vec, contract, contracterror, contractimpl, contracttype,
    panic_with_error, symbol_short,
};

#[contracttype]
pub enum DataKey {
    Enrollment(Address, String),
    MilestoneState(Address, String, u32),
    MilestoneSubmission(Address, String, u32),
    EnrolledCourses(Address),
    Course(String),
    CourseIds,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct CourseConfig {
    pub milestone_count: u32,
    pub active: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum MilestoneStatus {
    NotStarted,
    Pending,
    Approved,
    Rejected,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct MilestoneSubmission {
    pub evidence_uri: String,
    pub submitted_at: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct SubmittedEventData {
    pub learner: Address,
    pub course_id: String,
    pub evidence_uri: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct EnrolledEventData {
    pub learner: Address,
    pub course_id: String,
}

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const LEARN_TOKEN_KEY: Symbol = symbol_short!("LRN_TKN");
const PAUSED_KEY: Symbol = symbol_short!("PAUSED"); // ✅ NEW
const PERSISTENT_TTL_THRESHOLD: u32 = 100;
const PERSISTENT_TTL_BUMP: u32 = 1_000;

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    CourseNotFound = 4,
    MilestoneAlreadyCompleted = 5,
    CourseAlreadyComplete = 6,
    InvalidMilestones = 7,
    CourseAlreadyExists = 8,
    NotEnrolled = 9,
    DuplicateSubmission = 10,
    ContractPaused = 11,
}

#[contractevent]
pub struct MilestoneCompleted {
    pub learner: Address,
    pub course_id: u32,
    pub milestones_completed: u32,
    pub tokens_minted: i128,
}

#[contractevent]
pub struct CourseCompleted {
    pub learner: Address,
    pub course_id: u32,
}

#[contractevent]
pub struct CourseAdded {
    pub course_id: u32,
    pub total_milestones: u32,
    pub tokens_per_milestone: i128,
}

#[contract]
pub struct CourseMilestone;

#[contractimpl]
impl CourseMilestone {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&ADMIN_KEY, &admin);
    }

    // =======================
    // ✅ PAUSE FUNCTIONS
    // =======================

    pub fn pause(env: Env, admin: Address) {
        admin.require_auth();

        let stored_admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        if admin != stored_admin {
            panic_with_error!(&env, Error::Unauthorized);
        }

        env.storage().instance().set(&PAUSED_KEY, &true);
    }

    pub fn unpause(env: Env, admin: Address) {
        admin.require_auth();

        let stored_admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        if admin != stored_admin {
            panic_with_error!(&env, Error::Unauthorized);
        }

        env.storage().instance().set(&PAUSED_KEY, &false);
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&PAUSED_KEY).unwrap_or(false)
    }

    // =======================
    // MAIN FUNCTIONS
    // =======================

    pub fn enroll(env: Env, learner: Address, course_id: String) {
        if Self::is_paused(env.clone()) {
            panic_with_error!(&env, Error::ContractPaused);
        }

        Self::require_initialized(&env);
        learner.require_auth();

        // Enrollment is only allowed for registered, active courses.
        if !Self::is_course_active(&env, &course_id) {
            panic_with_error!(&env, Error::CourseNotFound);
        }

        let key = DataKey::Enrollment(learner.clone(), course_id.clone());
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::Unauthorized);
        }

        env.storage().persistent().set(&key, &true);
        Self::bump_persistent_ttl(&env, &key);

        let courses_key = DataKey::EnrolledCourses(learner.clone());
        let mut courses: Vec<String> = env
            .storage()
            .persistent()
            .get(&courses_key)
            .unwrap_or_else(|| Vec::new(&env));
        courses.push_back(course_id.clone());
        env.storage().persistent().set(&courses_key, &courses);
        Self::bump_persistent_ttl(&env, &courses_key);

        env.events().publish(
            (symbol_short!("enrolled"),),
            SubmittedEventData {
                learner,
                course_id,
                evidence_uri: String::from_str(&env, ""),
            },
        );
    }

    pub fn is_enrolled(env: Env, learner: Address, course_id: String) -> bool {
        let key = DataKey::Enrollment(learner, course_id);
        let enrolled = env.storage().persistent().get(&key).unwrap_or(false);
        if enrolled {
            Self::bump_persistent_ttl(&env, &key);
        }
        enrolled
    }

    pub fn submit_milestone(
        env: Env,
        learner: Address,
        course_id: String,
        milestone_id: u32,
        evidence_uri: String,
    ) {
        if Self::is_paused(env.clone()) {
            panic_with_error!(&env, Error::ContractPaused);
        }

        Self::require_initialized(&env);
        learner.require_auth();

        if !Self::is_enrolled(env.clone(), learner.clone(), course_id.clone()) {
            panic_with_error!(&env, Error::NotEnrolled);
        }

        let state_key = DataKey::MilestoneState(learner.clone(), course_id.clone(), milestone_id);
        let current_state = env
            .storage()
            .persistent()
            .get::<_, MilestoneStatus>(&state_key)
            .unwrap_or(MilestoneStatus::NotStarted);
        Self::bump_persistent_ttl(&env, &state_key);

        if current_state != MilestoneStatus::NotStarted {
            panic_with_error!(&env, Error::DuplicateSubmission);
        }

        let submission = MilestoneSubmission {
            evidence_uri: evidence_uri.clone(),
            submitted_at: env.ledger().timestamp(),
        };

        let submission_key =
            DataKey::MilestoneSubmission(learner.clone(), course_id.clone(), milestone_id);

        env.storage().persistent().set(&submission_key, &submission);
        Self::bump_persistent_ttl(&env, &submission_key);
        env.storage()
            .persistent()
            .set(&state_key, &MilestoneStatus::Pending);
        Self::bump_persistent_ttl(&env, &state_key);

        env.events().publish(
            (symbol_short!("submitted"), milestone_id),
            SubmittedEventData {
                learner,
                course_id,
                evidence_uri,
            },
        );
    }

    pub fn get_milestone_state(
        env: Env,
        learner: Address,
        course_id: String,
        milestone_id: u32,
    ) -> MilestoneStatus {
        let key = DataKey::MilestoneState(learner, course_id, milestone_id);
        let state = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(MilestoneStatus::NotStarted);
        Self::bump_persistent_ttl(&env, &key);
        state
    }

    pub fn get_milestone_status(
        env: Env,
        learner: Address,
        course_id: String,
        milestone_id: u32,
    ) -> MilestoneStatus {
        Self::get_milestone_state(env, learner, course_id, milestone_id)
    }

    pub fn get_milestone_status(
        env: Env,
        learner: Address,
        course_id: String,
        milestone_id: u32,
    ) -> MilestoneStatus {
        Self::get_milestone_state(env, learner, course_id, milestone_id)
    }

    pub fn get_milestone_submission(
        env: Env,
        learner: Address,
        course_id: String,
        milestone_id: u32,
    ) -> Option<MilestoneSubmission> {
        let key = DataKey::MilestoneSubmission(learner, course_id, milestone_id);
        let submission: Option<MilestoneSubmission> = env.storage().persistent().get(&key);
        if submission.is_some() {
            Self::bump_persistent_ttl(&env, &key);
        }
        submission
    }

    pub fn get_enrolled_courses(env: Env, learner: Address) -> Vec<String> {
        let key = DataKey::EnrolledCourses(learner);
        let courses: Vec<String> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(&env));
        if courses.len() > 0 {
            Self::bump_persistent_ttl(&env, &key);
        }
        courses
    }

    pub fn get_version(env: Env) -> String {
        String::from_str(&env, "1.0.0")
    }

    pub fn verify_milestone(
        env: Env,
        admin: Address,
        learner: Address,
        course_id: String,
        milestone_id: u32,
        tokens_amount: i128,
    ) {
        if Self::is_paused(env.clone()) {
            panic_with_error!(&env, Error::ContractPaused);
        }

        Self::require_initialized(&env);
        admin.require_auth();

        // Verify admin authorization
        let stored_admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        if admin != stored_admin {
            panic_with_error!(&env, Error::Unauthorized);
        }

        // Check if learner is enrolled
        if !Self::is_enrolled(env.clone(), learner.clone(), course_id.clone()) {
            panic_with_error!(&env, Error::NotEnrolled);
        }

        // Check current milestone state
        let state_key = DataKey::MilestoneState(learner.clone(), course_id.clone(), milestone_id);
        let current_state = env
            .storage()
            .persistent()
            .get::<_, MilestoneStatus>(&state_key)
            .unwrap_or(MilestoneStatus::NotStarted);

        if current_state != MilestoneStatus::Pending {
            panic_with_error!(&env, Error::InvalidState);
        }

        // Update milestone state to Approved
        env.storage()
            .persistent()
            .set(&state_key, &MilestoneStatus::Approved);

        // Get learn token contract address and mint tokens
        let learn_token_address: Address = env.storage().instance().get(&LEARN_TOKEN_KEY).unwrap();
        let learn_token_client = LearnTokenClient::new(&env, &learn_token_address);
        learn_token_client.mint(&learner, &tokens_amount);

        // Emit milestone completed event
        env.events().publish(
            symbol_short!("milestone_completed"),
            MilestoneCompleted {
                learner: learner.clone(),
                course_id: course_id.clone().parse::<u32>().unwrap_or(0),
                milestones_completed: milestone_id,
                tokens_minted: tokens_amount,
            },
        );
    }

    pub fn reject_milestone(
        env: Env,
        admin: Address,
        learner: Address,
        course_id: String,
        milestone_id: u32,
    ) {
        if Self::is_paused(env.clone()) {
            panic_with_error!(&env, Error::ContractPaused);
        }

        Self::require_initialized(&env);
        admin.require_auth();

        // Verify admin authorization
        let stored_admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        if admin != stored_admin {
            panic_with_error!(&env, Error::Unauthorized);
        }

        // Check if learner is enrolled
        if !Self::is_enrolled(env.clone(), learner.clone(), course_id.clone()) {
            panic_with_error!(&env, Error::NotEnrolled);
        }

        // Check current milestone state
        let state_key = DataKey::MilestoneState(learner.clone(), course_id.clone(), milestone_id);
        let current_state = env
            .storage()
            .persistent()
            .get::<_, CourseConfig>(&course_key)
        {
            Some(config) => config.active,
            None => false,
        }
    }

    fn bump_persistent_ttl(env: &Env, key: &DataKey) {
        env.storage()
            .persistent()
            .extend_ttl(key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_BUMP);
    }
}

#[cfg(test)]
mod test;
