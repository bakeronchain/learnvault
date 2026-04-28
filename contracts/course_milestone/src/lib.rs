#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    Address, BytesN, Env, String, Symbol, Vec, contract, contracterror, contractimpl, contracttype,
    panic_with_error, symbol_short,
};

/// A single entry in a batch verification call.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct VerifyBatchEntry {
    pub learner: Address,
    pub course_id: String,
    pub milestone_id: u32,
    pub lrn_reward: i128,
}

mod interface;
use interface::LearnTokenClient;

use learnvault_shared::upgrade;

pub use upgrade::ContractUpgraded;

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const INSTANCE_EXTEND_TO: u32 = DAY_IN_LEDGERS * 30;
const PERSISTENT_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const PERSISTENT_EXTEND_TO: u32 = DAY_IN_LEDGERS * 365;

#[contracttype]
pub enum DataKey {
    Enrollment(Address, String),
    MilestoneState(Address, String, u32),
    MilestoneSubmission(Address, String, u32),
    MilestoneLrn(String, u32),
    Completed(Address, String, u32),
    EnrolledCourses(Address),
    Course(String),
    CourseIds,
    CompletedCount(Address, String),
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
const PAUSED_KEY: Symbol = symbol_short!("PAUSED");

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
    AlreadyEnrolled = 12,
    InvalidState = 13,
    AlreadyCompleted = 14,
    InvalidReward = 15,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct MilestoneCompleted {
    pub learner: Address,
    pub course_id: String,
    pub milestone_id: u32,
    pub lrn_reward: i128,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct CourseCompleted {
    pub learner: Address,
    pub course_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct CourseAdded {
    pub course_id: String,
    pub total_milestones: u32,
    pub tokens_per_milestone: i128,
}

#[contract]
pub struct CourseMilestone;

#[contractimpl]
impl CourseMilestone {
    pub fn initialize(env: Env, admin: Address, learn_token_contract: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&ADMIN_KEY, &admin);
        upgrade::init(&env);
        env.storage()
            .instance()
            .set(&LEARN_TOKEN_KEY, &learn_token_contract);

        Self::extend_instance(&env);
    }

    pub fn add_course(env: Env, admin: Address, course_id: String, milestone_count: u32) {
        Self::require_initialized(&env);
        Self::require_admin(&env, &admin);

        if milestone_count == 0 {
            panic_with_error!(&env, Error::InvalidMilestones);
        }

        let course_key = DataKey::Course(course_id.clone());
        if env.storage().persistent().has(&course_key) {
            panic_with_error!(&env, Error::CourseAlreadyExists);
        }

        let config = CourseConfig {
            milestone_count,
            active: true,
        };
        env.storage().persistent().set(&course_key, &config);

        let mut course_ids: Vec<String> = env
            .storage()
            .persistent()
            .get(&DataKey::CourseIds)
            .unwrap_or_else(|| Vec::new(&env));
        course_ids.push_back(course_id);
        env.storage()
            .persistent()
            .set(&DataKey::CourseIds, &course_ids);

        Self::extend_persistent(&env, &course_key);
        Self::extend_persistent(&env, &DataKey::CourseIds);
    }

    pub fn set_milestone_reward(env: Env, course_id: String, milestone_id: u32, lrn: i128) {
        Self::assert_not_paused(&env);
        Self::require_initialized(&env);
        Self::require_stored_admin_auth(&env);

        if !Self::is_course_active(&env, &course_id) {
            panic_with_error!(&env, Error::CourseNotFound);
        }

        if lrn < 0 {
            panic_with_error!(&env, Error::InvalidReward);
        }

        let reward_key = DataKey::MilestoneLrn(course_id, milestone_id);
        env.storage().persistent().set(&reward_key, &lrn);
        Self::extend_persistent(&env, &reward_key);
    }

    pub fn remove_course(env: Env, admin: Address, course_id: String) {
        Self::require_initialized(&env);
        Self::require_admin(&env, &admin);

        let course_key = DataKey::Course(course_id);
        let mut config: CourseConfig = env
            .storage()
            .persistent()
            .get(&course_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::CourseNotFound));
        config.active = false;
        env.storage().persistent().set(&course_key, &config);
        Self::extend_persistent(&env, &course_key);
    }

    pub fn get_course(env: Env, course_id: String) -> Option<CourseConfig> {
        let course_key = DataKey::Course(course_id);
        let course: Option<CourseConfig> = env.storage().persistent().get(&course_key);
        if course.is_some() {
            Self::extend_persistent(&env, &course_key);
        }
        course
    }

    pub fn list_courses(env: Env) -> Vec<String> {
        let course_ids: Vec<String> = env
            .storage()
            .persistent()
            .get(&DataKey::CourseIds)
            .unwrap_or_else(|| Vec::new(&env));

        let mut active_courses = Vec::new(&env);
        let mut i = 0;
        while i < course_ids.len() {
            let course_id = course_ids.get(i).unwrap();
            let course_key = DataKey::Course(course_id.clone());
            let config: Option<CourseConfig> = env.storage().persistent().get(&course_key);
            if let Some(current) = config {
                Self::extend_persistent(&env, &course_key);
                if current.active {
                    active_courses.push_back(course_id);
                }
            }
            i += 1;
        }

        active_courses
    }

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

    fn assert_not_paused(env: &Env) {
        if Self::is_paused(env.clone()) {
            panic_with_error!(&env, Error::ContractPaused);
        }
    }

    pub fn enroll(env: Env, learner: Address, course_id: String) {
        Self::assert_not_paused(&env);
        Self::require_initialized(&env);
        learner.require_auth();

        if !Self::is_course_active(&env, &course_id) {
            panic_with_error!(&env, Error::CourseNotFound);
        }

        let key = DataKey::Enrollment(learner.clone(), course_id.clone());
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::AlreadyEnrolled);
        }

        env.storage().persistent().set(&key, &true);
        Self::extend_persistent(&env, &key);

        let courses_key = DataKey::EnrolledCourses(learner.clone());
        let mut courses: Vec<String> = env
            .storage()
            .persistent()
            .get(&courses_key)
            .unwrap_or_else(|| Vec::new(&env));
        courses.push_back(course_id.clone());
        env.storage().persistent().set(&courses_key, &courses);
        Self::extend_persistent(&env, &courses_key);

        env.events().publish(
            (symbol_short!("enrolled"),),
            EnrolledEventData { learner, course_id },
        );
    }

    pub fn is_enrolled(env: Env, learner: Address, course_id: String) -> bool {
        let key = DataKey::Enrollment(learner, course_id);
        let enrolled = env.storage().persistent().get(&key).unwrap_or(false);
        if enrolled {
            Self::extend_persistent(&env, &key);
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
        Self::assert_not_paused(&env);
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

        if current_state == MilestoneStatus::Pending || current_state == MilestoneStatus::Approved {
            panic_with_error!(&env, Error::DuplicateSubmission);
        }

        let submission = MilestoneSubmission {
            evidence_uri: evidence_uri.clone(),
            submitted_at: env.ledger().timestamp(),
        };

        let submission_key =
            DataKey::MilestoneSubmission(learner.clone(), course_id.clone(), milestone_id);

        env.storage().persistent().set(&submission_key, &submission);
        env.storage()
            .persistent()
            .set(&state_key, &MilestoneStatus::Pending);

        Self::extend_persistent(&env, &submission_key);
        Self::extend_persistent(&env, &state_key);

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
        Self::extend_instance(&env);
        let key = DataKey::MilestoneState(learner, course_id, milestone_id);
        if let Some(state) = env.storage().persistent().get::<_, MilestoneStatus>(&key) {
            Self::extend_persistent(&env, &key);
            state
        } else {
            MilestoneStatus::NotStarted
        }
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
            Self::extend_persistent(&env, &key);
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
        if !courses.is_empty() {
            Self::extend_persistent(&env, &key);
        }
        courses
    }

    pub fn complete_milestone(env: Env, learner: Address, course_id: String, milestone_id: u32) {
        Self::assert_not_paused(&env);
        Self::require_initialized(&env);
        Self::require_stored_admin_auth(&env);

        if !Self::is_enrolled(env.clone(), learner.clone(), course_id.clone()) {
            panic_with_error!(&env, Error::NotEnrolled);
        }

        let completed_key = DataKey::Completed(learner.clone(), course_id.clone(), milestone_id);
        let already_completed = env
            .storage()
            .persistent()
            .get::<_, bool>(&completed_key)
            .unwrap_or(false);
        if already_completed {
            panic_with_error!(&env, Error::AlreadyCompleted);
        }

        let state_key = DataKey::MilestoneState(learner.clone(), course_id.clone(), milestone_id);
        let current_state = env
            .storage()
            .persistent()
            .get::<_, MilestoneStatus>(&state_key)
            .unwrap_or(MilestoneStatus::NotStarted);
        if current_state == MilestoneStatus::Approved {
            panic_with_error!(&env, Error::AlreadyCompleted);
        }

        let reward_key = DataKey::MilestoneLrn(course_id.clone(), milestone_id);
        let lrn_reward = env
            .storage()
            .persistent()
            .get(&reward_key)
            .unwrap_or(0_i128);

        env.storage().persistent().set(&completed_key, &true);
        env.storage()
            .persistent()
            .set(&state_key, &MilestoneStatus::Approved);

        Self::extend_persistent(&env, &completed_key);
        Self::extend_persistent(&env, &state_key);
        if env.storage().persistent().has(&reward_key) {
            Self::extend_persistent(&env, &reward_key);
        }

        // Increment completion count
        let count_key = DataKey::CompletedCount(learner.clone(), course_id.clone());
        let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        env.storage().persistent().set(&count_key, &(count + 1));
        Self::extend_persistent(&env, &count_key);

        env.events().publish(
            (symbol_short!("ms_done"),),
            MilestoneCompleted {
                learner: learner.clone(),
                course_id: course_id.clone(),
                milestone_id,
                lrn_reward,
            },
        );

        Self::emit_course_completed_if_ready(&env, &learner, &course_id);
    }

    pub fn is_completed(env: Env, learner: Address, course_id: String, milestone_id: u32) -> bool {
        let completed_key = DataKey::Completed(learner, course_id, milestone_id);
        let completed = env
            .storage()
            .persistent()
            .get::<_, bool>(&completed_key)
            .unwrap_or(false);
        if completed {
            Self::extend_persistent(&env, &completed_key);
        }
        completed
    }

    /// Replace the current contract WASM with a new uploaded hash. Admin only.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        Self::require_initialized(&env);
        Self::extend_instance(&env);
        let admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        admin.require_auth();
        upgrade::apply(&env, &admin, &new_wasm_hash);
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

        let stored_admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        if admin != stored_admin {
            panic_with_error!(&env, Error::Unauthorized);
        }

        if !Self::is_enrolled(env.clone(), learner.clone(), course_id.clone()) {
            panic_with_error!(&env, Error::NotEnrolled);
        }

        let state_key = DataKey::MilestoneState(learner.clone(), course_id.clone(), milestone_id);
        let current_state = env
            .storage()
            .persistent()
            .get::<_, MilestoneStatus>(&state_key)
            .unwrap_or(MilestoneStatus::NotStarted);

        if current_state != MilestoneStatus::Pending {
            panic_with_error!(&env, Error::InvalidState);
        }

        env.storage()
            .persistent()
            .set(&state_key, &MilestoneStatus::Approved);
        let completed_key = DataKey::Completed(learner.clone(), course_id.clone(), milestone_id);
        env.storage().persistent().set(&completed_key, &true);

        let learn_token_address: Address = env.storage().instance().get(&LEARN_TOKEN_KEY).unwrap();
        let learn_token_client = LearnTokenClient::new(&env, &learn_token_address);
        learn_token_client.mint(&learner, &tokens_amount);

        Self::extend_persistent(&env, &state_key);
        Self::extend_persistent(&env, &completed_key);

        // Increment completion count
        let count_key = DataKey::CompletedCount(learner.clone(), course_id.clone());
        let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        env.storage().persistent().set(&count_key, &(count + 1));
        Self::extend_persistent(&env, &count_key);

        env.events().publish(
            (symbol_short!("ms_done"),),
            MilestoneCompleted {
                learner: learner.clone(),
                course_id: course_id.clone(),
                milestone_id,
                lrn_reward: tokens_amount,
            },
        );

        Self::emit_course_completed_if_ready(&env, &learner, &course_id);
    }

    /// Verify multiple milestone submissions in a single atomic transaction.
    ///
    /// Each [`VerifyBatchEntry`] is `(learner, course_id, milestone_id, lrn_reward)`.
    /// If any single verification fails the entire batch reverts.
    /// Emits a `MilestoneCompleted` event for each successful entry.
    pub fn batch_verify_milestones(env: Env, admin: Address, submissions: Vec<VerifyBatchEntry>) {
        if Self::is_paused(env.clone()) {
            panic_with_error!(&env, Error::ContractPaused);
        }

        Self::require_initialized(&env);
        admin.require_auth();

        let stored_admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        if admin != stored_admin {
            panic_with_error!(&env, Error::Unauthorized);
        }

        let learn_token_address: Address = env.storage().instance().get(&LEARN_TOKEN_KEY).unwrap();
        let learn_token_client = LearnTokenClient::new(&env, &learn_token_address);

        let mut i = 0;
        while i < submissions.len() {
            let entry = submissions.get(i).unwrap();

            if !Self::is_enrolled(env.clone(), entry.learner.clone(), entry.course_id.clone()) {
                panic_with_error!(&env, Error::NotEnrolled);
            }

            let state_key = DataKey::MilestoneState(
                entry.learner.clone(),
                entry.course_id.clone(),
                entry.milestone_id,
            );
            let current_state = env
                .storage()
                .persistent()
                .get::<_, MilestoneStatus>(&state_key)
                .unwrap_or(MilestoneStatus::NotStarted);

            if current_state != MilestoneStatus::Pending {
                panic_with_error!(&env, Error::InvalidState);
            }

            env.storage()
                .persistent()
                .set(&state_key, &MilestoneStatus::Approved);

            let completed_key = DataKey::Completed(
                entry.learner.clone(),
                entry.course_id.clone(),
                entry.milestone_id,
            );
            env.storage().persistent().set(&completed_key, &true);
            learn_token_client.mint(&entry.learner, &entry.lrn_reward);

            Self::extend_persistent(&env, &state_key);
            Self::extend_persistent(&env, &completed_key);

            env.events().publish(
                (symbol_short!("ms_done"),),
                MilestoneCompleted {
                    learner: entry.learner.clone(),
                    course_id: entry.course_id.clone(),
                    milestone_id: entry.milestone_id,
                    lrn_reward: entry.lrn_reward,
                },
            );

            // Increment completion count
            let count_key = DataKey::CompletedCount(entry.learner.clone(), entry.course_id.clone());
            let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
            env.storage().persistent().set(&count_key, &(count + 1));
            Self::extend_persistent(&env, &count_key);

            Self::emit_course_completed_if_ready(&env, &entry.learner, &entry.course_id);

            i += 1;
        }
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

        let stored_admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        if admin != stored_admin {
            panic_with_error!(&env, Error::Unauthorized);
        }

        if !Self::is_enrolled(env.clone(), learner.clone(), course_id.clone()) {
            panic_with_error!(&env, Error::NotEnrolled);
        }

        let state_key = DataKey::MilestoneState(learner.clone(), course_id.clone(), milestone_id);
        let current_state = env
            .storage()
            .persistent()
            .get::<_, MilestoneStatus>(&state_key)
            .unwrap_or(MilestoneStatus::NotStarted);

        if current_state != MilestoneStatus::Pending {
            panic_with_error!(&env, Error::InvalidState);
        }

        env.storage()
            .persistent()
            .set(&state_key, &MilestoneStatus::Rejected);

        let submission_key = DataKey::MilestoneSubmission(learner, course_id, milestone_id);
        env.storage().persistent().remove(&submission_key);
    }

    fn require_initialized(env: &Env) {
        if !env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(env, Error::NotInitialized);
        }
    }

    fn require_admin(env: &Env, admin: &Address) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&ADMIN_KEY)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
        if stored_admin != *admin {
            panic_with_error!(env, Error::Unauthorized);
        }
    }

    fn require_stored_admin_auth(env: &Env) {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&ADMIN_KEY)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
        stored_admin.require_auth();
    }

    fn is_course_active(env: &Env, course_id: &String) -> bool {
        let course_key = DataKey::Course(course_id.clone());
        match env
            .storage()
            .persistent()
            .get::<_, CourseConfig>(&course_key)
        {
            Some(config) => {
                Self::extend_persistent(env, &course_key);
                config.active
            }
            None => false,
        }
    }

    fn emit_course_completed_if_ready(env: &Env, learner: &Address, course_id: &String) {
        let course_key = DataKey::Course(course_id.clone());
        let config: CourseConfig = match env.storage().persistent().get(&course_key) {
            Some(cfg) => cfg,
            None => return,
        };
        Self::extend_persistent(env, &course_key);

        let count_key = DataKey::CompletedCount(learner.clone(), course_id.clone());
        let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);

        if count == config.milestone_count {
            env.events().publish(
                (Symbol::new(env, "course_done"),),
                CourseCompleted {
                    learner: learner.clone(),
                    course_id: course_id.clone(),
                },
            );
        }
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
