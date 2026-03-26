extern crate std;

use soroban_sdk::{Address, Env, String, testutils::Address as _};

use crate::{CourseMilestone, CourseMilestoneClient, Error, MilestoneStatus};

fn sid(env: &Env, value: &str) -> String {
    String::from_str(env, value)
}

fn setup() -> (Env, Address, Address, CourseMilestoneClient<'static>) {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(CourseMilestone, ());
    env.mock_all_auths();
    let client = CourseMilestoneClient::new(&env, &contract_id);
    client.initialize(&admin);
    (env, contract_id, admin, client)
}

#[test]
fn enrolls_learner() {
    let (env, _contract_id, _admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    client.enroll(&learner, &course_id);

    assert!(client.is_enrolled(&learner, &course_id));
}

#[test]
fn enrolled_learner_can_submit_once_and_submission_is_stored() {
    let (env, _contract_id, _admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence_uri = sid(&env, "ipfs://bafy-test-proof");

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
    let (env, _contract_id, _admin, client) = setup();
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

#[test]
fn get_version_returns_semver() {
    let (env, _contract_id, _admin, client) = setup();
    assert_eq!(client.get_version(), String::from_str(&env, "1.0.0"));
}
