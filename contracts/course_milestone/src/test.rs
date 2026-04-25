extern crate std;

use soroban_sdk::{
    Address, BytesN, Env, IntoVal, String, Symbol, Val, Vec, contract, contractimpl, contracttype,
    symbol_short,
    testutils::{Address as _, Events as _, MockAuth, MockAuthInvoke},
};

use crate::{
    CourseCompleted, CourseConfig, CourseMilestone, CourseMilestoneClient, DataKey, Error,
    MilestoneCompleted, MilestoneStatus, VerifyBatchEntry,
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

    (
        env,
        contract_id,
        admin,
        learn_token_id,
        client,
        token_client,
    )
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
        (
            learner.clone(),
            course_id.clone(),
            milestone_id,
            evidence_uri.clone(),
        ),
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
        (
            admin.clone(),
            learner.clone(),
            course_id.clone(),
            1_u32,
            125_i128,
        ),
    );
    client.verify_milestone(&admin, &learner, &course_id, &1, &125);

    assert_eq!(
        client.get_milestone_state(&learner, &course_id, &1),
        MilestoneStatus::Approved
    );
    assert!(client.is_completed(&learner, &course_id, &1));
    assert_eq!(token_client.balance(&learner), 125);
}

#[test]
fn verify_milestone_emits_course_completed_event_on_final_milestone() {
    let (env, contract_id, admin, _token_id, client, _token_client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let evidence_1 = sid(&env, "ipfs://proof-1");
    let evidence_2 = sid(&env, "ipfs://proof-2");

    add_course(&env, &contract_id, &admin, &client, &course_id, 2);
    enroll(&env, &contract_id, &learner, &client, &course_id);

    submit_milestone(
        &env,
        &contract_id,
        &learner,
        &client,
        &course_id,
        1,
        &evidence_1,
    );
    authorize(
        &env,
        &admin,
        &contract_id,
        "verify_milestone",
        (
            admin.clone(),
            learner.clone(),
            course_id.clone(),
            1_u32,
            10_i128,
        ),
    );
    client.verify_milestone(&admin, &learner, &course_id, &1, &10);

    submit_milestone(
        &env,
        &contract_id,
        &learner,
        &client,
        &course_id,
        2,
        &evidence_2,
    );
    authorize(
        &env,
        &admin,
        &contract_id,
        "verify_milestone",
        (
            admin.clone(),
            learner.clone(),
            course_id.clone(),
            2_u32,
            20_i128,
        ),
    );
    client.verify_milestone(&admin, &learner, &course_id, &2, &20);

    let events = env.events().all();
    let completion_events = events
        .iter()
        .filter(|(_, topics, data)| {
            topics.contains(&Symbol::new(&env, "course_done").into_val(&env)) && {
                let payload: CourseCompleted = data.clone().into_val(&env);
                payload
                    == CourseCompleted {
                        learner: learner.clone(),
                        course_id: course_id.clone(),
                    }
            }
        })
        .count();

    assert_eq!(completion_events, 1);
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
        (
            attacker.clone(),
            learner.clone(),
            course_id.clone(),
            1_u32,
            125_i128,
        ),
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
        client.get_milestone_state(&learner, &course_id, &1),
        MilestoneStatus::Rejected
    );
    assert!(
        client
            .get_milestone_submission(&learner, &course_id, &1)
            .is_none()
    );
}

#[test]
fn rejected_milestone_can_be_resubmitted() {
    let (env, contract_id, admin, _token_id, client, _token_client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");
    let first_evidence_uri = sid(&env, "ipfs://proof-1");
    let second_evidence_uri = sid(&env, "ipfs://proof-2");

    add_course(&env, &contract_id, &admin, &client, &course_id, 3);
    enroll(&env, &contract_id, &learner, &client, &course_id);
    submit_milestone(
        &env,
        &contract_id,
        &learner,
        &client,
        &course_id,
        1,
        &first_evidence_uri,
    );

    authorize(
        &env,
        &admin,
        &contract_id,
        "reject_milestone",
        (admin.clone(), learner.clone(), course_id.clone(), 1_u32),
    );
    client.reject_milestone(&admin, &learner, &course_id, &1);

    submit_milestone(
        &env,
        &contract_id,
        &learner,
        &client,
        &course_id,
        1,
        &second_evidence_uri,
    );

    assert_eq!(client.get_milestone_state(&learner, &course_id, &1), MilestoneStatus::Pending);

    let submission = client
        .get_milestone_submission(&learner, &course_id, &1)
        .expect("submission should exist after resubmission");
    assert_eq!(submission.evidence_uri, second_evidence_uri);
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
        topics.contains(&symbol_short!("ms_done").into_val(&env)) && {
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
        client.get_milestone_state(&learner, &course_id, &2),
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

// ── batch_verify_milestones ──────────────────────────────────────────────────

#[allow(dead_code)]
fn verify_milestone_helper(
    env: &Env,
    contract_id: &Address,
    admin: &Address,
    client: &CourseMilestoneClient<'static>,
    learner: &Address,
    course_id: &String,
    milestone_id: u32,
    tokens: i128,
) {
    authorize(
        env,
        admin,
        contract_id,
        "verify_milestone",
        (
            admin.clone(),
            learner.clone(),
            course_id.clone(),
            milestone_id,
            tokens,
        ),
    );
    client.verify_milestone(admin, learner, course_id, &milestone_id, &tokens);
}

#[test]
fn batch_verify_milestones_happy_path() {
    let (env, contract_id, admin, _token_id, client, token_client) = setup();
    let learner1 = Address::generate(&env);
    let learner2 = Address::generate(&env);
    let course_id = sid(&env, "batch-course");

    add_course(&env, &contract_id, &admin, &client, &course_id, 3);
    enroll(&env, &contract_id, &learner1, &client, &course_id);
    enroll(&env, &contract_id, &learner2, &client, &course_id);

    let uri = sid(&env, "ipfs://evidence");
    submit_milestone(&env, &contract_id, &learner1, &client, &course_id, 1, &uri);
    submit_milestone(&env, &contract_id, &learner2, &client, &course_id, 1, &uri);

    let submissions = soroban_sdk::vec![
        &env,
        VerifyBatchEntry {
            learner: learner1.clone(),
            course_id: course_id.clone(),
            milestone_id: 1,
            lrn_reward: 100,
        },
        VerifyBatchEntry {
            learner: learner2.clone(),
            course_id: course_id.clone(),
            milestone_id: 1,
            lrn_reward: 200,
        },
    ];
    authorize(
        &env,
        &admin,
        &contract_id,
        "batch_verify_milestones",
        (admin.clone(), submissions.clone()),
    );
    client.batch_verify_milestones(&admin, &submissions);

    assert_eq!(
        client.get_milestone_state(&learner1, &course_id, &1),
        MilestoneStatus::Approved,
    );
    assert_eq!(
        client.get_milestone_state(&learner2, &course_id, &1),
        MilestoneStatus::Approved,
    );
    assert_eq!(token_client.balance(&learner1), 100);
    assert_eq!(token_client.balance(&learner2), 200);
}

#[test]
fn batch_verify_milestones_reverts_on_invalid_entry() {
    let (env, contract_id, admin, _token_id, client, token_client) = setup();
    let learner1 = Address::generate(&env);
    let not_enrolled = Address::generate(&env);
    let course_id = sid(&env, "batch-course");

    add_course(&env, &contract_id, &admin, &client, &course_id, 3);
    enroll(&env, &contract_id, &learner1, &client, &course_id);

    let uri = sid(&env, "ipfs://evidence");
    submit_milestone(&env, &contract_id, &learner1, &client, &course_id, 1, &uri);

    // Second entry: not_enrolled learner has no enrollment → should cause revert
    let submissions = soroban_sdk::vec![
        &env,
        VerifyBatchEntry {
            learner: learner1.clone(),
            course_id: course_id.clone(),
            milestone_id: 1,
            lrn_reward: 100,
        },
        VerifyBatchEntry {
            learner: not_enrolled.clone(),
            course_id: course_id.clone(),
            milestone_id: 1,
            lrn_reward: 100,
        },
    ];

    authorize(
        &env,
        &admin,
        &contract_id,
        "batch_verify_milestones",
        (admin.clone(), submissions.clone()),
    );
    let result = client.try_batch_verify_milestones(&admin, &submissions);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::NotEnrolled as u32
        )))
    );

    // Because the batch reverted, learner1 should NOT be marked approved
    assert_eq!(
        client.get_milestone_state(&learner1, &course_id, &1),
        MilestoneStatus::Pending,
    );
    // And no tokens were minted
    assert_eq!(token_client.balance(&learner1), 0);
}

#[test]
fn upgrade_requires_admin_auth() {
    let (env, contract_id, _admin, _token_id, client, _token_client) = setup();
    let attacker = Address::generate(&env);
    let wasm_hash: BytesN<32> = crate::upgrade::testutils::upload_upgrade_target(&env);

    authorize(
        &env,
        &attacker,
        &contract_id,
        "upgrade",
        (wasm_hash.clone(),),
    );
    let result = client.try_upgrade(&wasm_hash);

    assert!(result.is_err());
}

#[test]
fn state_persists_after_upgrade() {
    let (env, contract_id, admin, _token_id, client, _token_client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "soroban-101");

    add_course(&env, &contract_id, &admin, &client, &course_id, 3);
    enroll(&env, &contract_id, &learner, &client, &course_id);

    let wasm_hash = crate::upgrade::testutils::upload_upgrade_target(&env);
    authorize(&env, &admin, &contract_id, "upgrade", (wasm_hash.clone(),));
    client.upgrade(&wasm_hash);

    let stored_course = env.as_contract(&contract_id, || {
        env.storage()
            .persistent()
            .get::<_, CourseConfig>(&DataKey::Course(course_id.clone()))
    });
    let enrolled = env.as_contract(&contract_id, || {
        env.storage()
            .persistent()
            .get::<_, bool>(&DataKey::Enrollment(learner.clone(), course_id.clone()))
            .unwrap_or(false)
    });
    let stored_hash = env.as_contract(&contract_id, || crate::upgrade::current_hash(&env));

    assert_eq!(
        stored_course,
        Some(CourseConfig {
            milestone_count: 3,
            active: true,
        })
    );
    assert!(enrolled);
    assert_eq!(stored_hash, wasm_hash);
}

#[test]
fn benchmark_costs() {
    let (env, contract_id, admin, _token_id, client, _token_client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, "rust-101");

    // 1. Benchmark add_course
    env.cost_estimate().budget().reset_unlimited();
    add_course(&env, &contract_id, &admin, &client, &course_id, 3);
    let add_instr = env.cost_estimate().budget().cpu_instruction_cost();
    let add_mem = env.cost_estimate().budget().memory_bytes_cost();

    // 2. Benchmark enroll
    env.cost_estimate().budget().reset_unlimited();
    enroll(&env, &contract_id, &learner, &client, &course_id);
    let enroll_instr = env.cost_estimate().budget().cpu_instruction_cost();
    let enroll_mem = env.cost_estimate().budget().memory_bytes_cost();

    // 3. Benchmark complete_milestone
    env.cost_estimate().budget().reset_unlimited();
    authorize(
        &env,
        &admin,
        &contract_id,
        "complete_milestone",
        (learner.clone(), course_id.clone(), 1_u32),
    );
    client.complete_milestone(&learner, &course_id, &1);
    let comp_instr = env.cost_estimate().budget().cpu_instruction_cost();
    let comp_mem = env.cost_estimate().budget().memory_bytes_cost();

    extern crate std;
    std::println!("BENCHMARK_RESULTS: course_milestone");
    std::println!("add_course: instr={}, mem={}", add_instr, add_mem);
    std::println!("enroll: instr={}, mem={}", enroll_instr, enroll_mem);
    std::println!("complete_milestone: instr={}, mem={}", comp_instr, comp_mem);
}
