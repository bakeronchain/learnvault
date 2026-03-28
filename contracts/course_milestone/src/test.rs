extern crate std;

use soroban_sdk::{
    Address, Env, IntoVal, String, Val, Vec, contract, contractimpl, contracttype, symbol_short, vec,
    testutils::{Address as _, Events as _, MockAuth, MockAuthInvoke},
};

use crate::{
    CourseConfig, CourseMilestone, CourseMilestoneClient, DataKey, Error, MilestoneCompleted,
    MilestoneStatus,
};

#[contracttype]
enum MockTokenDataKey {
    Balance(Address),
}

#[contract]
struct MockLearnToken;

#[contractimpl]
impl MockLearnToken {
    pub fn mint(env: Env, to: Address, amount: i128) {
        let key = MockTokenDataKey::Balance(to.clone());
        let balance = env.storage().persistent().get(&key).unwrap_or(0_i128);
        env.storage().persistent().set(&key, &(balance + amount));
    }

    pub fn balance(env: Env, account: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&MockTokenDataKey::Balance(account))
            .unwrap_or(0_i128)
    }
}

fn sid(env: &Env, value: &str) -> String {
    String::from_str(env, value)
}

fn authorize<T>(env: &Env, address: &Address, contract: &Address, fn_name: &'static str, args: T)
where
    T: IntoVal<Env, Vec<Val>>,
{
    env.mock_auths(&[MockAuth {
        address,
        invoke: &MockAuthInvoke {
            contract,
            fn_name,
            args: args.into_val(env),
            sub_invokes: &[],
        },
    }]);
}

fn setup() -> (
    Env,
    Address,
    Address,
    Address,
    CourseMilestoneClient<'static>,
    MockLearnTokenClient<'static>,
) {
    let env = Env::default();
    let admin = Address::generate(&env);
    let learn_token_id = env.register(MockLearnToken, ());
    let contract_id = env.register(CourseMilestone, ());

    let client = CourseMilestoneClient::new(&env, &contract_id);
    let token_client = MockLearnTokenClient::new(&env, &learn_token_id);

    authorize(
        &env,
        &admin,
        &contract_id,
        "initialize",
        (admin.clone(), learn_token_id.clone()),
    );
    client.initialize(&admin, &learn_token_id);

    (env, contract_id, admin, learn_token_id, client, token_client)
}

fn add_course(
    env: &Env,
    contract_id: &Address,
    admin: &Address,
    client: &CourseMilestoneClient<'static>,
    course_id: &String,
    milestone_count: u32,
) {
    authorize(
        env,
        admin,
        contract_id,
        "add_course",
        (admin.clone(), course_id.clone(), milestone_count),
    );
    client.add_course(admin, course_id, &milestone_count);
}

fn enroll(
    env: &Env,
    contract_id: &Address,
    learner: &Address,
    client: &CourseMilestoneClient<'static>,
    course_id: &String,
) {
    authorize(
        env,
        learner,
        contract_id,
        "enroll",
        (learner.clone(), course_id.clone()),
    );
    client.enroll(learner, course_id);
}

fn submit_milestone(
    env: &Env,
    contract_id: &Address,
    learner: &Address,
    client: &CourseMilestoneClient<'static>,
    course_id: &String,
    milestone_id: u32,
    evidence_uri: &String,
) {
    authorize(
        env,
        learner,
        contract_id,
        "submit_milestone",
        (learner.clone(), course_id.clone(), milestone_id, evidence_uri.clone()),
    );
    client.submit_milestone(learner, course_id, &milestone_id, evidence_uri);
}

#[test]
fn add_course_and_get_course_work() {
    let (env, contract_id, admin, _token_id, client, _token_client) = setup();
    let course_id = sid(&env, "rust-101");

    add_course(&env, &contract_id, &admin, &client, &course_id, 4);

    let course = client
        .get_course(&course_id)
        .expect("course should be stored after add");
    assert_eq!(
        course,
        CourseConfig {
            milestone_count: 4,
            active: true,
        }
    );
}

#[test]
fn enrolls_learner_in_active_course() {
    let (env, contract_id, admin, _token_id, client, _token_client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    add_course(&env, &contract_id, &admin, &client, &course_id, 3);
    enroll(&env, &contract_id, &learner, &client, &course_id);

    assert!(client.is_enrolled(&learner, &course_id));
}

#[test]
fn duplicate_enroll_fails() {
    let (env, contract_id, admin, _token_id, client, _token_client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    add_course(&env, &contract_id, &admin, &client, &course_id, 3);
    enroll(&env, &contract_id, &learner, &client, &course_id);

    authorize(
        &env,
        &learner,
        &contract_id,
        "enroll",
        (learner.clone(), course_id.clone()),
    );
    let result = client.try_enroll(&learner, &course_id);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::AlreadyEnrolled as u32
        )))
    );
}

#[test]
fn submit_milestone_stores_pending_submission() {
    let (env, contract_id, admin, _token_id, client, _token_client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence_uri = sid(&env, "ipfs://proof");

    add_course(&env, &contract_id, &admin, &client, &course_id, 3);
    enroll(&env, &contract_id, &learner, &client, &course_id);
    submit_milestone(
        &env,
        &contract_id,
        &learner,
        &client,
        &course_id,
        1,
        &evidence_uri,
    );

    assert_eq!(
        client.get_milestone_state(&learner, &course_id, &1),
        MilestoneStatus::Pending
    );

    let submission = client
        .get_milestone_submission(&learner, &course_id, &1)
        .expect("submission should exist");
    assert_eq!(submission.evidence_uri, evidence_uri);
}

#[test]
fn verify_milestone_mints_lrn_and_marks_completion() {
    let (env, contract_id, admin, _token_id, client, token_client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence_uri = sid(&env, "ipfs://proof");

    add_course(&env, &contract_id, &admin, &client, &course_id, 3);
    enroll(&env, &contract_id, &learner, &client, &course_id);
    submit_milestone(
        &env,
        &contract_id,
        &learner,
        &client,
        &course_id,
        1,
        &evidence_uri,
    );

    authorize(
        &env,
        &admin,
        &contract_id,
        "verify_milestone",
        (admin.clone(), learner.clone(), course_id.clone(), 1_u32, 125_i128),
    );
    client.verify_milestone(&admin, &learner, &course_id, &1, &125);

    assert_eq!(
        client.get_milestone_status(&learner, &course_id, &1),
        MilestoneStatus::Approved
    );
    assert!(client.is_completed(&learner, &course_id, &1));
    assert_eq!(token_client.balance(&learner), 125);
}

#[test]
fn verify_milestone_fails_for_non_admin() {
    let (env, contract_id, admin, _token_id, client, _token_client) = setup();
    let learner = Address::generate(&env);
    let attacker = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence_uri = sid(&env, "ipfs://proof");

    add_course(&env, &contract_id, &admin, &client, &course_id, 3);
    enroll(&env, &contract_id, &learner, &client, &course_id);
    submit_milestone(
        &env,
        &contract_id,
        &learner,
        &client,
        &course_id,
        1,
        &evidence_uri,
    );

    authorize(
        &env,
        &attacker,
        &contract_id,
        "verify_milestone",
        (attacker.clone(), learner.clone(), course_id.clone(), 1_u32, 125_i128),
    );
    let result = client.try_verify_milestone(&attacker, &learner, &course_id, &1, &125);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::Unauthorized as u32
        )))
    );
}

#[test]
fn reject_milestone_marks_rejected_and_clears_submission() {
    let (env, contract_id, admin, _token_id, client, _token_client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence_uri = sid(&env, "ipfs://proof");

    add_course(&env, &contract_id, &admin, &client, &course_id, 3);
    enroll(&env, &contract_id, &learner, &client, &course_id);
    submit_milestone(
        &env,
        &contract_id,
        &learner,
        &client,
        &course_id,
        1,
        &evidence_uri,
    );

    authorize(
        &env,
        &admin,
        &contract_id,
        "reject_milestone",
        (admin.clone(), learner.clone(), course_id.clone(), 1_u32),
    );
    client.reject_milestone(&admin, &learner, &course_id, &1);

    assert_eq!(
        client.get_milestone_status(&learner, &course_id, &1),
        MilestoneStatus::Rejected
    );
    assert!(client.get_milestone_submission(&learner, &course_id, &1).is_none());
}

#[test]
fn set_milestone_reward_stores_config() {
    let (env, contract_id, admin, _token_id, client, _token_client) = setup();
    let course_id = sid(&env, "rust-101");

    add_course(&env, &contract_id, &admin, &client, &course_id, 3);

    authorize(
        &env,
        &admin,
        &contract_id,
        "set_milestone_reward",
        (course_id.clone(), 1_u32, 75_i128),
    );
    client.set_milestone_reward(&course_id, &1, &75);

    let stored_reward = env.as_contract(&contract_id, || {
        env.storage()
            .persistent()
            .get::<_, i128>(&DataKey::MilestoneLrn(course_id.clone(), 1))
            .unwrap_or(0)
    });

    assert_eq!(stored_reward, 75);
}

#[test]
fn complete_milestone_marks_completion_and_emits_reward_event() {
    let (env, contract_id, admin, _token_id, client, _token_client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    add_course(&env, &contract_id, &admin, &client, &course_id, 3);
    enroll(&env, &contract_id, &learner, &client, &course_id);

    authorize(
        &env,
        &admin,
        &contract_id,
        "set_milestone_reward",
        (course_id.clone(), 2_u32, 75_i128),
    );
    client.set_milestone_reward(&course_id, &2, &75);

    authorize(
        &env,
        &admin,
        &contract_id,
        "complete_milestone",
        (learner.clone(), course_id.clone(), 2_u32),
    );
    client.complete_milestone(&learner, &course_id, &2);

    let events = env.events().all();
    let found = events.iter().any(|(_, topics, data)| {
        topics.contains(&symbol_short!("ms_done").into_val(&env))
            && {
                let d: MilestoneCompleted = data.clone().into_val(&env);
                d == MilestoneCompleted {
                    learner: learner.clone(),
                    course_id: course_id.clone(),
                    milestone_id: 2,
                    lrn_reward: 75,
                }
            }
    });
    assert!(found, "completion event with reward was not emitted");

    assert!(client.is_completed(&learner, &course_id, &2));
    assert_eq!(
        client.get_milestone_status(&learner, &course_id, &2),
        MilestoneStatus::Approved
    );
}

#[test]
fn complete_milestone_fails_when_already_completed() {
    let (env, contract_id, admin, _token_id, client, _token_client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    add_course(&env, &contract_id, &admin, &client, &course_id, 3);
    enroll(&env, &contract_id, &learner, &client, &course_id);

    authorize(
        &env,
        &admin,
        &contract_id,
        "complete_milestone",
        (learner.clone(), course_id.clone(), 1_u32),
    );
    client.complete_milestone(&learner, &course_id, &1);

    authorize(
        &env,
        &admin,
        &contract_id,
        "complete_milestone",
        (learner.clone(), course_id.clone(), 1_u32),
    );
    let result = client.try_complete_milestone(&learner, &course_id, &1);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::AlreadyCompleted as u32
        )))
    );
}

#[test]
fn complete_milestone_fails_for_non_enrolled_learner() {
    let (env, contract_id, admin, _token_id, client, _token_client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    add_course(&env, &contract_id, &admin, &client, &course_id, 3);

    authorize(
        &env,
        &admin,
        &contract_id,
        "complete_milestone",
        (learner.clone(), course_id.clone(), 1_u32),
    );
    let result = client.try_complete_milestone(&learner, &course_id, &1);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::NotEnrolled as u32
        )))
    );
}

#[test]
fn complete_milestone_fails_without_admin_auth() {
    let (env, contract_id, admin, _token_id, client, _token_client) = setup();
    let learner = Address::generate(&env);
    let attacker = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    add_course(&env, &contract_id, &admin, &client, &course_id, 3);
    enroll(&env, &contract_id, &learner, &client, &course_id);

    authorize(
        &env,
        &attacker,
        &contract_id,
        "complete_milestone",
        (learner.clone(), course_id.clone(), 1_u32),
    );
    let result = client.try_complete_milestone(&learner, &course_id, &1);

    assert!(result.is_err());
}
