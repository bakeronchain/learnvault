extern crate std;

use soroban_sdk::{
    Address, Env, String,
    testutils::{Address as _, Ledger, LedgerInfo},
};

use crate::{CourseConfig, CourseMilestone, CourseMilestoneClient, DataKey, Error, MilestoneStatus};

fn sid(env: &Env, value: &str) -> String {
    String::from_str(env, value)
}

fn setup() -> (Env, Address, Address, CourseMilestoneClient<'static>) {
    let env = Env::default();
    let admin = Address::generate(&env);
    let learn_token = Address::generate(&env);
    let contract_id = env.register(CourseMilestone, ());
    env.mock_all_auths();
    let client = CourseMilestoneClient::new(&env, &contract_id);
    client.initialize(&admin, &learn_token);
    (env, contract_id, admin, client)
}

fn set_ledger_sequence(env: &Env, sequence_number: u32) {
    env.ledger().set(LedgerInfo {
        timestamp: 1_700_000_000,
        protocol_version: 23,
        sequence_number,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 6312000,
    });
}

#[test]
fn enrolls_learner() {
    let (env, _contract_id, admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    client.add_course(&admin, &course_id, &10);
    client.enroll(&learner, &course_id);

    assert!(client.is_enrolled(&learner, &course_id));
}

#[test]
fn enrolled_learner_can_submit_once_and_submission_is_stored() {
    let (env, _contract_id, admin, client) = setup();
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
    let (env, _contract_id, admin, client) = setup();
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

#[test]
fn get_milestone_state_returns_not_started_by_default() {
    let (env, _contract_id, _admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    let status = client.get_milestone_state(&learner, &course_id, &1);
    assert_eq!(status, MilestoneStatus::NotStarted);
}

#[test]
fn get_milestone_state_returns_pending_after_submission() {
    let (env, _contract_id, admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence = sid(&env, "ipfs://bafy-proof");

    client.add_course(&admin, &course_id, &4);
    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1, &evidence);

    let status = client.get_milestone_state(&learner, &course_id, &1);
    assert_eq!(status, MilestoneStatus::Pending);
}

#[test]
fn get_milestone_state_not_started_for_unsubmitted_milestone() {
    let (env, _contract_id, admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence = sid(&env, "ipfs://bafy-proof");

    client.add_course(&admin, &course_id, &4);
    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1, &evidence);

    let status = client.get_milestone_state(&learner, &course_id, &2);
    assert_eq!(status, MilestoneStatus::NotStarted);
}

#[test]
fn get_enrolled_courses_returns_empty_for_new_learner() {
    let (env, _contract_id, _admin, client) = setup();
    let learner = Address::generate(&env);

    let courses = client.get_enrolled_courses(&learner);
    assert_eq!(courses.len(), 0);
}

#[test]
fn get_enrolled_courses_returns_enrolled_courses() {
    let (env, _contract_id, admin, client) = setup();
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
    let (env, _contract_id, admin, client) = setup();
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

#[test]
fn get_version_returns_semver() {
    let (env, _contract_id, _admin, client) = setup();
    assert_eq!(client.get_version(), String::from_str(&env, "1.0.0"));
}

#[test]
fn add_course_and_get_course_work() {
    let (env, _contract_id, admin, client) = setup();
    let course_id = sid(&env, "soroban-101");

    client.add_course(&admin, &course_id, &12);

    let course = client
        .get_course(&course_id)
        .expect("course should be stored after add");
    assert_eq!(
        course,
        CourseConfig {
            milestone_count: 12,
            active: true,
        }
    );
}

#[test]
fn list_courses_returns_empty_when_none_exist() {
    let (_env, _contract_id, _admin, client) = setup();
    assert_eq!(client.list_courses().len(), 0);
}

#[test]
fn list_courses_returns_only_active_courses() {
    let (env, _contract_id, admin, client) = setup();
    let course_a = sid(&env, "rust-101");
    let course_b = sid(&env, "defi-201");

    client.add_course(&admin, &course_a, &5);
    client.add_course(&admin, &course_b, &7);
    client.remove_course(&admin, &course_b);

    let courses = client.list_courses();
    assert_eq!(courses.len(), 1);
    assert_eq!(courses.get(0).unwrap(), course_a);
}

#[test]
fn remove_course_marks_course_inactive() {
    let (env, _contract_id, admin, client) = setup();
    let course_id = sid(&env, "rust-101");
    let learner = Address::generate(&env);

    client.add_course(&admin, &course_id, &4);
    client.remove_course(&admin, &course_id);

    let stored = client
        .get_course(&course_id)
        .expect("course should remain stored");
    assert_eq!(stored.active, false);

    let result = client.try_enroll(&learner, &course_id);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::CourseNotFound as u32
        )))
    );
}

#[test]
fn pause_blocks_enroll() {
    let (env, _contract_id, admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    client.pause(&admin);

    let result = client.try_enroll(&learner, &course_id);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::ContractPaused as u32
        )))
    );
}

#[test]
fn pause_blocks_submission() {
    let (env, _contract_id, admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence = sid(&env, "ipfs://proof");

    client.add_course(&admin, &course_id, &1);
    client.enroll(&learner, &course_id);
    client.pause(&admin);

    let result = client.try_submit_milestone(&learner, &course_id, &1, &evidence);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::ContractPaused as u32
        )))
    );
}

#[test]
fn unpause_restores_functionality() {
    let (env, _contract_id, admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    client.add_course(&admin, &course_id, &1);
    client.pause(&admin);
    client.unpause(&admin);

    client.enroll(&learner, &course_id);

    assert!(client.is_enrolled(&learner, &course_id));
}

#[test]
fn non_admin_cannot_add_course() {
    let (env, _contract_id, _admin, client) = setup();
    let attacker = Address::generate(&env);
    let result = client.try_add_course(&attacker, &sid(&env, "rust-101"), &3);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::Unauthorized as u32
        )))
    );
}

#[test]
fn non_admin_cannot_remove_course() {
    let (env, _contract_id, admin, client) = setup();
    let attacker = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    client.add_course(&admin, &course_id, &3);

    let result = client.try_remove_course(&attacker, &course_id);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::Unauthorized as u32
        )))
    );
}

#[test]
fn enroll_rejects_unknown_course() {
    let (env, _contract_id, _admin, client) = setup();
    let learner = Address::generate(&env);
    let result = client.try_enroll(&learner, &sid(&env, "missing"));

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::CourseNotFound as u32
        )))
    );
}

#[test]
fn duplicate_course_id_is_rejected() {
    let (env, _contract_id, admin, client) = setup();
    let course_id = sid(&env, "rust-101");
    client.add_course(&admin, &course_id, &3);

    let result = client.try_add_course(&admin, &course_id, &3);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::CourseAlreadyExists as u32
        )))
    );
}

#[test]
fn zero_milestone_count_is_rejected() {
    let (env, _contract_id, admin, client) = setup();
    let result = client.try_add_course(&admin, &sid(&env, "rust-101"), &0);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidMilestones as u32
        )))
    );
}

#[test]
fn multiple_courses_are_stored() {
    let (env, _contract_id, admin, client) = setup();
    client.add_course(&admin, &sid(&env, "rust-101"), &3);
    client.add_course(&admin, &sid(&env, "defi-201"), &5);
    client.add_course(&admin, &sid(&env, "soroban-301"), &8);

    assert_eq!(client.list_courses().len(), 3);
}

#[test]
fn progress_persists_beyond_instance_ttl_window() {
    let (env, contract_id, admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    set_ledger_sequence(&env, 1);
    client.add_course(&admin, &course_id, &3);
    client.enroll(&learner, &course_id);

    set_ledger_sequence(&env, 400);

    let enrollment_key = DataKey::Enrollment(learner, course_id);
    let still_present = env.as_contract(&contract_id, || {
        env.storage()
            .persistent()
            .get::<_, bool>(&enrollment_key)
            .unwrap_or(false)
    });

    assert!(still_present);
}
