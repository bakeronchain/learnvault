extern crate std;

use soroban_sdk::{Address, Env, String, contract, contractimpl, testutils::Address as _};

use crate::{CourseConfig, CourseMilestone, CourseMilestoneClient, MilestoneStatus, ScholarStats};

// ---------------------------------------------------------------------------
// Mock LearnToken — a no-op contract so verify_milestone's mint call succeeds
// ---------------------------------------------------------------------------

#[contract]
pub struct MockLearnToken;

#[contractimpl]
impl MockLearnToken {
    pub fn mint(_env: Env, _to: Address, _amount: i128) {
        // no-op in tests
    }
}

fn setup() -> (Env, Address, Address, CourseMilestoneClient<'static>) {
    let env = Env::default();

    let admin = Address::generate(&env);
    let learn_token_id = env.register(MockLearnToken, ());

    let contract_id = env.register(CourseMilestone, ());
    env.mock_all_auths();
    let client = CourseMilestoneClient::new(&env, &contract_id);
    client.initialize(&admin, &learn_token_id);

    (env, admin, contract_id, client)
}

// ---------------------------------------------------------------------------
// Existing tests
// ---------------------------------------------------------------------------

#[test]
fn test_initialize() {
    let (_env, _admin, _contract_id, _client) = setup();
}

#[test]
fn test_add_course() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let course_id: u32 = 1;
    client.add_course(&course_id, &5, &100);

    let config = client.get_course_config(&course_id);
    assert_eq!(
        config,
        Some(CourseConfig {
            total_milestones: 5,
            tokens_per_milestone: 100,
        })
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_add_course_invalid_milestones() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let course_id: u32 = 1;
    client.add_course(&course_id, &0, &100);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_add_course_duplicate() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let course_id: u32 = 1;
    client.add_course(&course_id, &5, &100);
    client.add_course(&course_id, &5, &100);
}

#[test]
fn test_get_progress_zero_initially() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &5, &100);

    assert_eq!(client.get_progress(&learner, &course_id), 0);
}

#[test]
fn test_is_course_complete_false_initially() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &5, &100);

    assert!(!client.is_course_complete(&learner, &course_id));
}

#[test]
fn test_is_course_complete_nonexistent_course() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 999;

    assert!(!client.is_course_complete(&learner, &course_id));
}

// ---------------------------------------------------------------------------
// Enrollment tests
// ---------------------------------------------------------------------------

#[test]
fn test_enroll_and_check() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &3, &50);
    assert!(!client.is_enrolled(&learner, &course_id));

    client.enroll(&learner, &course_id);
    assert!(client.is_enrolled(&learner, &course_id));
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_enroll_nonexistent_course() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    client.enroll(&learner, &999);
}

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn test_enroll_duplicate() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &3, &50);
    client.enroll(&learner, &course_id);
    client.enroll(&learner, &course_id); // should panic
}

// ---------------------------------------------------------------------------
// submit_milestone tests
// ---------------------------------------------------------------------------

#[test]
fn test_submit_milestone_sets_pending() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &3, &50);
    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1);

    assert_eq!(
        client.get_milestone_status(&learner, &course_id, &1),
        Some(MilestoneStatus::Pending)
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_submit_milestone_not_enrolled() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &3, &50);
    client.submit_milestone(&learner, &course_id, &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")]
fn test_submit_milestone_invalid_id() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &3, &50);
    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &0); // invalid: 0
}

// ---------------------------------------------------------------------------
// verify_milestone tests
// ---------------------------------------------------------------------------

#[test]
fn test_verify_milestone_updates_state_and_progress() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &3, &50);
    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1);
    client.verify_milestone(&learner, &course_id, &1);

    assert_eq!(
        client.get_milestone_status(&learner, &course_id, &1),
        Some(MilestoneStatus::Verified)
    );
    assert_eq!(client.get_progress(&learner, &course_id), 1);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn test_verify_milestone_already_verified() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &3, &50);
    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1);
    client.verify_milestone(&learner, &course_id, &1);
    client.verify_milestone(&learner, &course_id, &1); // should panic
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_verify_milestone_not_enrolled() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &3, &50);
    client.verify_milestone(&learner, &course_id, &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")]
fn test_verify_milestone_invalid_id() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &3, &50);
    client.enroll(&learner, &course_id);
    client.verify_milestone(&learner, &course_id, &99); // out of range
}

// ---------------------------------------------------------------------------
// reject_milestone tests
// ---------------------------------------------------------------------------

#[test]
fn test_reject_milestone_from_pending() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &3, &50);
    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1);

    let reason = String::from_str(&env, "Incomplete submission");
    client.reject_milestone(&learner, &course_id, &1, &reason);

    assert_eq!(
        client.get_milestone_status(&learner, &course_id, &1),
        Some(MilestoneStatus::Rejected)
    );
    assert_eq!(
        client.get_rejection_reason(&learner, &course_id, &1),
        Some(reason)
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn test_reject_milestone_not_pending() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &3, &50);
    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1);
    client.verify_milestone(&learner, &course_id, &1);

    // Try to reject an already-verified milestone
    let reason = String::from_str(&env, "Too late");
    client.reject_milestone(&learner, &course_id, &1, &reason);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn test_reject_milestone_no_submission() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &3, &50);
    client.enroll(&learner, &course_id);

    // No submit_milestone call — no Pending state
    let reason = String::from_str(&env, "Never submitted");
    client.reject_milestone(&learner, &course_id, &1, &reason);
}

#[test]
fn test_resubmit_after_rejection() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &3, &50);
    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1);

    let reason = String::from_str(&env, "Needs more detail");
    client.reject_milestone(&learner, &course_id, &1, &reason);

    // Should be able to resubmit after rejection
    client.submit_milestone(&learner, &course_id, &1);
    assert_eq!(
        client.get_milestone_status(&learner, &course_id, &1),
        Some(MilestoneStatus::Pending)
    );
}

#[test]
fn test_get_scholar_stats_counts_mixed_states() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let second_learner = Address::generate(&env);

    client.add_course(&1, &3, &50);
    client.add_course(&2, &2, &75);

    client.enroll(&learner, &1);
    client.enroll(&learner, &2);
    client.enroll(&second_learner, &2);

    client.submit_milestone(&learner, &1, &1);
    client.verify_milestone(&learner, &1, &1);

    client.submit_milestone(&learner, &1, &2);

    client.submit_milestone(&learner, &2, &1);
    let reason = String::from_str(&env, "Missing proof");
    client.reject_milestone(&learner, &2, &1, &reason);

    client.submit_milestone(&second_learner, &2, &1);
    client.verify_milestone(&second_learner, &2, &1);

    assert_eq!(
        client.get_scholar_stats(&learner),
        ScholarStats {
            enrolled_courses: 2,
            completed_milestones: 1,
            pending_milestones: 1,
            rejected_milestones: 1,
        }
    );
}

#[test]
fn test_get_scholar_stats_returns_zero_for_unenrolled_learner() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);

    client.add_course(&1, &3, &50);

    assert_eq!(
        client.get_scholar_stats(&learner),
        ScholarStats {
            enrolled_courses: 0,
            completed_milestones: 0,
            pending_milestones: 0,
            rejected_milestones: 0,
        }
    );
}
