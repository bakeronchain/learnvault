extern crate std;

use soroban_sdk::{Address, Env, String, testutils::Address as _};

use crate::{CourseConfig, CourseMilestone, CourseMilestoneClient, Error, MilestoneStatus};

fn sid(env: &Env, value: &str) -> String {
    String::from_str(env, value)
}

fn setup() -> (Env, Address, Address, Address, CourseMilestoneClient<'static>) {
    let env = Env::default();
    let admin = Address::generate(&env);
    let learn_token = Address::generate(&env);
    let learn_token_address = Address::generate(&env);
    let contract_id = env.register(CourseMilestone, ());
    env.mock_all_auths();
    let client = CourseMilestoneClient::new(&env, &contract_id);
    client.initialize(&admin);
    (env, contract_id, admin, client)
}

// =======================
// ✅ ENROLL TESTS
// =======================

#[test]
fn enrolls_learner() {
    let (env, _contract_id, _admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    client.add_course(&admin, &course_id, &10);
    client.enroll(&learner, &course_id);

    assert!(client.is_enrolled(&learner, &course_id));
}

#[test]
fn duplicate_enroll_fails() {
    let (env, _contract_id, _admin, _learn_token_address, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    client.enroll(&learner, &course_id);

    let result = client.try_enroll(&learner, &course_id);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::Unauthorized as u32
        )))
    );
}

#[test]
fn enroll_fails_when_not_initialized() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let learn_token_address = Address::generate(&env);
    let contract_id = env.register(CourseMilestone, ());
    let client = CourseMilestoneClient::new(&env, &contract_id);
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    let result = client.try_enroll(&learner, &course_id);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::NotInitialized as u32
        )))
    );
}

// =======================
// ✅ SUBMIT MILESTONE TESTS
// =======================

#[test]
fn enrolled_learner_can_submit_once_and_submission_is_stored() {
    let (env, _contract_id, _admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence_uri = sid(&env, "ipfs://bafy-test-proof");

    client.add_course(&admin, &course_id, &5);
    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1, &evidence_uri);

    let state = client.get_milestone_state(&learner, &course_id, &1);
    assert_eq!(state, MilestoneStatus::Pending);

    let submission = client
        .get_milestone_submission(&learner, &course_id, &1)
        .expect("submission should exist");
    assert_eq!(submission.evidence_uri, evidence_uri);
    assert_eq!(submission.submitted_at, env.ledger().timestamp());
}

#[test]
fn non_enrolled_learner_cannot_submit() {
    let (env, _contract_id, _admin, _learn_token_address, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence_uri = sid(&env, "ipfs://bafy-test-proof");

    let result = client.try_submit_milestone(&learner, &course_id, &1, &evidence_uri);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::NotEnrolled as u32
        )))
    );
}

#[test]
fn duplicate_submission_is_rejected() {
    let (env, _contract_id, _admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence_uri = sid(&env, "ipfs://bafy-test-proof");

    client.add_course(&admin, &course_id, &8);
    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &7, &evidence_uri);

    let result = client.try_submit_milestone(&learner, &course_id, &7, &evidence_uri);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::DuplicateSubmission as u32
        )))
    );
}

// =======================
// ✅ VERIFY MILESTONE TESTS
// =======================

#[test]
fn verify_milestone_happy_path() {
    let (env, _contract_id, admin, _learn_token_address, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence_uri = sid(&env, "ipfs://bafy-proof");

    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1, &evidence_uri);

    client.verify_milestone(&admin, &learner, &course_id, &1, &100);

    let status = client.get_milestone_status(&learner, &course_id, &1);
    assert_eq!(status, MilestoneStatus::Approved);
}

#[test]
fn verify_milestone_fails_for_non_admin() {
    let (env, _contract_id, _admin, _learn_token_address, client) = setup();
    let learner = Address::generate(&env);
    let non_admin = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence_uri = sid(&env, "ipfs://bafy-proof");

    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1, &evidence_uri);

    let result = client.try_verify_milestone(&non_admin, &learner, &course_id, &1, &100);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::Unauthorized as u32
        )))
    );
}

#[test]
fn verify_milestone_fails_for_already_verified() {
    let (env, _contract_id, admin, _learn_token_address, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence_uri = sid(&env, "ipfs://bafy-proof");

    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1, &evidence_uri);
    client.verify_milestone(&admin, &learner, &course_id, &1, &100);

    let result = client.try_verify_milestone(&admin, &learner, &course_id, &1, &100);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidState as u32
        )))
    );
}

#[test]
fn verify_milestone_fails_for_not_enrolled_learner() {
    let (env, _contract_id, admin, _learn_token_address, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    let result = client.try_verify_milestone(&admin, &learner, &course_id, &1, &100);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::NotEnrolled as u32
        )))
    );
}

// =======================
// ✅ REJECT MILESTONE TESTS
// =======================

#[test]
fn reject_milestone_happy_path() {
    let (env, _contract_id, admin, _learn_token_address, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence_uri = sid(&env, "ipfs://bafy-proof");

    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1, &evidence_uri);

    client.reject_milestone(&admin, &learner, &course_id, &1);

    let status = client.get_milestone_status(&learner, &course_id, &1);
    assert_eq!(status, MilestoneStatus::Rejected);

    // Submission should be removed
    let submission = client.get_milestone_submission(&learner, &course_id, &1);
    assert!(submission.is_none());
}

#[test]
fn reject_milestone_fails_for_non_admin() {
    let (env, _contract_id, _admin, _learn_token_address, client) = setup();
    let learner = Address::generate(&env);
    let non_admin = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence_uri = sid(&env, "ipfs://bafy-proof");

    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1, &evidence_uri);

    let result = client.try_reject_milestone(&non_admin, &learner, &course_id, &1);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::Unauthorized as u32
        )))
    );
}

#[test]
fn reject_milestone_fails_for_wrong_state() {
    let (env, _contract_id, admin, _learn_token_address, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    client.enroll(&learner, &course_id);

    // Try to reject a milestone that hasn't been submitted
    let result = client.try_reject_milestone(&admin, &learner, &course_id, &1);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidState as u32
        )))
    );
}

// =======================
// ✅ GET MILESTONE STATUS TESTS
// =======================

#[test]
fn get_milestone_status_returns_not_started_by_default() {
    let (env, _contract_id, _admin, _learn_token_address, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    let status = client.get_milestone_status(&learner, &course_id, &1);
    assert_eq!(status, MilestoneStatus::NotStarted);
}

#[test]
fn get_milestone_status_returns_pending_after_submission() {
    let (env, _contract_id, _admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence = sid(&env, "ipfs://bafy-proof");

    client.add_course(&admin, &course_id, &4);
    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1, &evidence);

    let status = client.get_milestone_status(&learner, &course_id, &1);
    assert_eq!(status, MilestoneStatus::Pending);
}

#[test]
fn get_milestone_status_returns_approved_after_verification() {
    let (env, _contract_id, admin, _learn_token_address, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence = sid(&env, "ipfs://bafy-proof");

    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1, &evidence);
    client.verify_milestone(&admin, &learner, &course_id, &1, &100);

    let status = client.get_milestone_status(&learner, &course_id, &1);
    assert_eq!(status, MilestoneStatus::Approved);
}

#[test]
fn get_milestone_status_returns_rejected_after_rejection() {
    let (env, _contract_id, admin, _learn_token_address, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence = sid(&env, "ipfs://bafy-proof");

    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1, &evidence);
    client.reject_milestone(&admin, &learner, &course_id, &1);

    let status = client.get_milestone_status(&learner, &course_id, &1);
    assert_eq!(status, MilestoneStatus::Rejected);
}

#[test]
fn get_milestone_status_not_started_for_unsubmitted_milestone() {
    let (env, _contract_id, _admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence = sid(&env, "ipfs://bafy-proof");

    client.add_course(&admin, &course_id, &4);
    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1, &evidence);

    let status = client.get_milestone_status(&learner, &course_id, &2);
    assert_eq!(status, MilestoneStatus::NotStarted);
}

// =======================
// ✅ LRN MINTING INTEGRATION TESTS
// =======================

#[test]
fn verify_milestone_mints_lrn_tokens() {
    let (env, _contract_id, admin, learn_token_address, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence_uri = sid(&env, "ipfs://bafy-proof");

    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1, &evidence_uri);

    // This would require a mock learn token contract for full testing
    // For now, we just verify the function call succeeds
    client.verify_milestone(&admin, &learner, &course_id, &1, &100);

    let status = client.get_milestone_status(&learner, &course_id, &1);
    assert_eq!(status, MilestoneStatus::Approved);
}

// =======================
// ✅ ENROLLED COURSES TESTS
// =======================

#[test]
fn get_enrolled_courses_returns_empty_for_new_learner() {
    let (env, _contract_id, _admin, _learn_token_address, client) = setup();
    let learner = Address::generate(&env);

    let courses = client.get_enrolled_courses(&learner);
    assert_eq!(courses.len(), 0);
}

#[test]
fn get_enrolled_courses_returns_enrolled_courses() {
    let (env, _contract_id, _admin, client) = setup();
    let learner = Address::generate(&env);

    client.add_course(&admin, &sid(&env, "rust-101"), &3);
    client.add_course(&admin, &sid(&env, "defi-201"), &6);
    client.enroll(&learner, &sid(&env, "rust-101"));
    client.enroll(&learner, &sid(&env, "defi-201"));

    let courses = client.get_enrolled_courses(&learner);
    assert_eq!(courses.len(), 2);
    assert_eq!(courses.get(0).unwrap(), sid(&env, "rust-101"));
    assert_eq!(courses.get(1).unwrap(), sid(&env, "defi-201"));
}

#[test]
fn get_enrolled_courses_is_per_learner() {
    let (env, _contract_id, _admin, client) = setup();
    let learner_a = Address::generate(&env);
    let learner_b = Address::generate(&env);

    client.add_course(&admin, &sid(&env, "rust-101"), &3);
    client.add_course(&admin, &sid(&env, "defi-201"), &6);
    client.enroll(&learner_a, &sid(&env, "rust-101"));
    client.enroll(&learner_a, &sid(&env, "defi-201"));
    client.enroll(&learner_b, &sid(&env, "rust-101"));

    assert_eq!(client.get_enrolled_courses(&learner_a).len(), 2);
    assert_eq!(client.get_enrolled_courses(&learner_b).len(), 1);
}

// =======================
// ✅ VERSION TESTS
// =======================

#[test]
fn get_version_returns_semver() {
    let (env, _contract_id, _admin, _learn_token_address, client) = setup();
    assert_eq!(client.get_version(), String::from_str(&env, "1.0.0"));
}
