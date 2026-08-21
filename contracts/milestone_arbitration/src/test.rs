extern crate std;

use soroban_sdk::{
    Address, Bytes, BytesN, Env, IntoVal,
    testutils::{Address as _, Ledger, LedgerInfo, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
};

use crate::{
    ArbitrationError, BPS_DENOMINATOR, DISPUTE_WINDOW_SECONDS, MAX_JUROR_SELECTION_WEIGHT,
    MIN_JUROR_STAKE, MINORITY_SLASH_BPS, MilestoneArbitration, MilestoneArbitrationClient,
    NON_PARTICIPATION_SLASH_BPS, PANEL_SIZE, SCHOLAR_DISPUTE_STAKE,
};

const START_TS: u64 = 1_700_000_000;
const START_SEQ: u32 = 1_000;

struct Fixture<'a> {
    env: Env,
    client: MilestoneArbitrationClient<'a>,
    contract_id: Address,
    token: TokenClient<'a>,
    admin: Address,
    treasury: Address,
    scholar: Address,
}

fn set_ledger(env: &Env, timestamp: u64, sequence_number: u32) {
    env.ledger().set(LedgerInfo {
        timestamp,
        protocol_version: 23,
        sequence_number,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 6_312_000,
    });
}

fn setup<'a>() -> Fixture<'a> {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, START_TS, START_SEQ);

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let scholar = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = sac.address();
    StellarAssetClient::new(&env, &token_address).mint(&scholar, &(SCHOLAR_DISPUTE_STAKE * 10));

    let contract_id = env.register(MilestoneArbitration, ());
    let client = MilestoneArbitrationClient::new(&env, &contract_id);
    client.initialize(&admin, &token_address, &treasury);

    Fixture {
        token: TokenClient::new(&env, &token_address),
        env,
        client,
        contract_id,
        admin,
        treasury,
        scholar,
    }
}

fn contract_error(
    error: ArbitrationError,
) -> Option<Result<soroban_sdk::Error, soroban_sdk::InvokeError>> {
    Some(Ok(soroban_sdk::Error::from_contract_error(error as u32)))
}

fn evidence_hash(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

fn salt(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

/// Mirrors the contract's private `compute_commitment` so tests can produce
/// valid commitments without reaching into contract internals.
fn make_commitment(env: &Env, dispute_id: u64, vote: bool, salt: &BytesN<32>) -> BytesN<32> {
    let mut bytes = Bytes::new(env);
    bytes.append(&Bytes::from_array(env, &dispute_id.to_be_bytes()));
    bytes.append(&Bytes::from_array(env, &[if vote { 1u8 } else { 0u8 }]));
    bytes.append(&Bytes::from(salt.clone()));
    env.crypto().sha256(&bytes).into()
}

fn join_juror(f: &Fixture, stake: i128) -> Address {
    let juror = Address::generate(&f.env);
    StellarAssetClient::new(&f.env, &f.token.address).mint(&juror, &(stake + MIN_JUROR_STAKE));
    f.client.join_panel(&juror, &stake);
    juror
}

fn take_vec(env: &Env, vec: &soroban_sdk::Vec<Address>, n: u32) -> soroban_sdk::Vec<Address> {
    let mut result = soroban_sdk::Vec::new(env);
    for i in 0..n.min(vec.len()) {
        result.push_back(vec.get(i).unwrap());
    }
    result
}

fn join_default_pool(f: &Fixture) -> std::vec::Vec<Address> {
    let mut jurors = std::vec::Vec::new();
    for _ in 0..PANEL_SIZE {
        jurors.push(join_juror(f, MIN_JUROR_STAKE));
    }
    jurors
}

fn open_dispute(f: &Fixture, proposal_id: u32, milestone_id: u32) -> u64 {
    let hash = evidence_hash(&f.env, 7);
    f.client
        .open_dispute(&f.scholar, &proposal_id, &milestone_id, &hash, &START_TS)
}

/// Commits and reveals every panel member, voting `true` (release) for
/// `votes_for` of them and `false` for the rest, in panel order.
fn commit_and_reveal(
    f: &Fixture,
    dispute_id: u64,
    panel: &soroban_sdk::Vec<Address>,
    votes_for: u32,
) {
    let salts: std::vec::Vec<BytesN<32>> = (0..panel.len())
        .map(|i| salt(&f.env, i as u8 + 1))
        .collect();
    let votes: std::vec::Vec<bool> = (0..panel.len()).map(|i| i < votes_for).collect();

    for (i, juror) in panel.iter().enumerate() {
        let commitment = make_commitment(&f.env, dispute_id, votes[i], &salts[i]);
        f.client.commit_vote(&dispute_id, &juror, &commitment);
    }

    set_ledger(
        &f.env,
        START_TS + crate::COMMIT_WINDOW_SECONDS + 1,
        START_SEQ + 1,
    );

    for (i, juror) in panel.iter().enumerate() {
        f.client
            .reveal_vote(&dispute_id, &juror, &votes[i], &salts[i]);
    }
}

// ---------------------------------------------------------------------------
// initialization
// ---------------------------------------------------------------------------

#[test]
fn initialize_stores_config() {
    let f = setup();
    let config = f.client.get_config();
    assert_eq!(config.admin, f.admin);
    assert_eq!(config.treasury, f.treasury);
    assert_eq!(config.lrn_token, f.token.address);
}

#[test]
fn double_initialize_reverts() {
    let f = setup();
    let result = f
        .client
        .try_initialize(&f.admin, &f.token.address, &f.treasury);
    assert_eq!(
        result.err(),
        contract_error(ArbitrationError::AlreadyInitialized)
    );
}

// ---------------------------------------------------------------------------
// juror pool
// ---------------------------------------------------------------------------

#[test]
fn join_panel_transfers_stake_and_records_juror() {
    let f = setup();
    let juror = join_juror(&f, MIN_JUROR_STAKE);
    assert!(f.client.is_juror(&juror));
    assert_eq!(f.client.get_juror_stake(&juror), MIN_JUROR_STAKE);
    assert_eq!(f.token.balance(&f.contract_id), MIN_JUROR_STAKE);
}

#[test]
fn join_panel_below_minimum_stake_fails() {
    let f = setup();
    let juror = Address::generate(&f.env);
    StellarAssetClient::new(&f.env, &f.token.address).mint(&juror, &MIN_JUROR_STAKE);
    let result = f.client.try_join_panel(&juror, &(MIN_JUROR_STAKE - 1));
    assert_eq!(result.err(), contract_error(ArbitrationError::InvalidStake));
}

#[test]
fn double_join_rejected() {
    let f = setup();
    let juror = join_juror(&f, MIN_JUROR_STAKE);
    StellarAssetClient::new(&f.env, &f.token.address).mint(&juror, &MIN_JUROR_STAKE);
    let result = f.client.try_join_panel(&juror, &MIN_JUROR_STAKE);
    assert_eq!(result.err(), contract_error(ArbitrationError::AlreadyJuror));
}

#[test]
fn leave_panel_refunds_stake() {
    let f = setup();
    let juror = join_juror(&f, MIN_JUROR_STAKE);
    f.client.leave_panel(&juror);
    assert!(!f.client.is_juror(&juror));
    assert_eq!(f.token.balance(&f.contract_id), 0);
}

#[test]
fn leave_panel_with_active_dispute_fails() {
    let f = setup();
    let panel = join_default_pool(&f);
    open_dispute(&f, 1, 1);

    let result = f.client.try_leave_panel(&panel[0]);
    assert_eq!(
        result.err(),
        contract_error(ArbitrationError::JurorHasActiveDisputes)
    );
}

// ---------------------------------------------------------------------------
// open_dispute
// ---------------------------------------------------------------------------

#[test]
fn open_dispute_draws_full_panel_and_starts_commit_window() {
    let f = setup();
    join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);

    let dispute = f.client.get_dispute(&dispute_id).unwrap();
    assert_eq!(dispute.panel.len(), PANEL_SIZE);
    assert_eq!(dispute.scholar, f.scholar);
    assert_eq!(dispute.scholar_stake, SCHOLAR_DISPUTE_STAKE);
    assert_eq!(
        dispute.commit_deadline,
        START_TS + crate::COMMIT_WINDOW_SECONDS
    );
    assert_eq!(
        dispute.reveal_deadline,
        START_TS + crate::COMMIT_WINDOW_SECONDS + crate::REVEAL_WINDOW_SECONDS
    );
    assert_eq!(
        f.token.balance(&f.contract_id),
        MIN_JUROR_STAKE * (PANEL_SIZE as i128) + SCHOLAR_DISPUTE_STAKE
    );
}

#[test]
fn open_dispute_with_insufficient_pool_fails() {
    let f = setup();
    for _ in 0..(PANEL_SIZE - 1) {
        join_juror(&f, MIN_JUROR_STAKE);
    }
    let hash = evidence_hash(&f.env, 1);
    let result = f
        .client
        .try_open_dispute(&f.scholar, &1, &1, &hash, &START_TS);
    assert_eq!(
        result.err(),
        contract_error(ArbitrationError::InsufficientPool)
    );
}

#[test]
fn open_dispute_twice_for_same_milestone_fails() {
    let f = setup();
    join_default_pool(&f);
    open_dispute(&f, 1, 1);

    let hash = evidence_hash(&f.env, 2);
    let result = f
        .client
        .try_open_dispute(&f.scholar, &1, &1, &hash, &START_TS);
    assert_eq!(
        result.err(),
        contract_error(ArbitrationError::DisputeExists)
    );
}

#[test]
fn open_dispute_outside_window_rejected() {
    let f = setup();
    join_default_pool(&f);

    let rejected_at = START_TS;
    set_ledger(&f.env, START_TS + DISPUTE_WINDOW_SECONDS + 1, START_SEQ);

    let hash = evidence_hash(&f.env, 3);
    let result = f
        .client
        .try_open_dispute(&f.scholar, &1, &1, &hash, &rejected_at);
    assert_eq!(
        result.err(),
        contract_error(ArbitrationError::DisputeWindowExpired)
    );
}

#[test]
fn open_dispute_with_future_rejected_at_fails() {
    let f = setup();
    join_default_pool(&f);
    let hash = evidence_hash(&f.env, 4);
    let result = f
        .client
        .try_open_dispute(&f.scholar, &1, &1, &hash, &(START_TS + 1));
    assert_eq!(
        result.err(),
        contract_error(ArbitrationError::RejectedAtInFuture)
    );
}

#[test]
fn only_the_scholar_can_open_their_own_dispute() {
    let env = Env::default();
    set_ledger(&env, START_TS, START_SEQ);

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let scholar = Address::generate(&env);
    let attacker = Address::generate(&env);

    env.mock_all_auths();
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = sac.address();
    StellarAssetClient::new(&env, &token_address).mint(&scholar, &(SCHOLAR_DISPUTE_STAKE * 2));

    let contract_id = env.register(MilestoneArbitration, ());
    let client = MilestoneArbitrationClient::new(&env, &contract_id);
    client.initialize(&admin, &token_address, &treasury);

    for _ in 0..PANEL_SIZE {
        let juror = Address::generate(&env);
        StellarAssetClient::new(&env, &token_address).mint(&juror, &(MIN_JUROR_STAKE * 2));
        client.join_panel(&juror, &MIN_JUROR_STAKE);
    }

    let hash = evidence_hash(&env, 5);

    // The attacker signs, but names `scholar` as the dispute's scholar.
    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "open_dispute",
            args: (scholar.clone(), 1u32, 1u32, hash.clone(), START_TS).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_open_dispute(&scholar, &1, &1, &hash, &START_TS);
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// commit / reveal
// ---------------------------------------------------------------------------

#[test]
fn commit_vote_requires_panel_membership() {
    let f = setup();
    join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);

    let outsider = join_juror(&f, MIN_JUROR_STAKE);
    let commitment = make_commitment(&f.env, dispute_id, true, &salt(&f.env, 1));
    let result = f
        .client
        .try_commit_vote(&dispute_id, &outsider, &commitment);
    assert_eq!(
        result.err(),
        contract_error(ArbitrationError::NotPanelMember)
    );
}

#[test]
fn double_vote_rejected() {
    let f = setup();
    join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);
    let dispute = f.client.get_dispute(&dispute_id).unwrap();

    let juror = dispute.panel.get(0).unwrap();
    let commitment = make_commitment(&f.env, dispute_id, true, &salt(&f.env, 1));
    f.client.commit_vote(&dispute_id, &juror, &commitment);

    let result = f.client.try_commit_vote(&dispute_id, &juror, &commitment);
    assert_eq!(
        result.err(),
        contract_error(ArbitrationError::AlreadyCommitted)
    );
}

#[test]
fn commit_after_deadline_fails() {
    let f = setup();
    join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);
    let dispute = f.client.get_dispute(&dispute_id).unwrap();
    let juror = dispute.panel.get(0).unwrap();

    set_ledger(
        &f.env,
        START_TS + crate::COMMIT_WINDOW_SECONDS + 1,
        START_SEQ,
    );
    let commitment = make_commitment(&f.env, dispute_id, true, &salt(&f.env, 1));
    let result = f.client.try_commit_vote(&dispute_id, &juror, &commitment);
    assert_eq!(
        result.err(),
        contract_error(ArbitrationError::CommitWindowClosed)
    );
}

#[test]
fn reveal_before_commit_deadline_fails() {
    let f = setup();
    join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);
    let dispute = f.client.get_dispute(&dispute_id).unwrap();
    let juror = dispute.panel.get(0).unwrap();

    let s = salt(&f.env, 1);
    let commitment = make_commitment(&f.env, dispute_id, true, &s);
    f.client.commit_vote(&dispute_id, &juror, &commitment);

    let result = f.client.try_reveal_vote(&dispute_id, &juror, &true, &s);
    assert_eq!(
        result.err(),
        contract_error(ArbitrationError::RevealWindowNotOpen)
    );
}

#[test]
fn reveal_after_reveal_deadline_fails() {
    let f = setup();
    join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);
    let dispute = f.client.get_dispute(&dispute_id).unwrap();
    let juror = dispute.panel.get(0).unwrap();

    let s = salt(&f.env, 1);
    let commitment = make_commitment(&f.env, dispute_id, true, &s);
    f.client.commit_vote(&dispute_id, &juror, &commitment);

    set_ledger(
        &f.env,
        START_TS + crate::COMMIT_WINDOW_SECONDS + crate::REVEAL_WINDOW_SECONDS + 1,
        START_SEQ,
    );
    let result = f.client.try_reveal_vote(&dispute_id, &juror, &true, &s);
    assert_eq!(
        result.err(),
        contract_error(ArbitrationError::RevealWindowClosed)
    );
}

#[test]
fn reveal_with_wrong_salt_is_rejected_not_ignored() {
    let f = setup();
    join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);
    let dispute = f.client.get_dispute(&dispute_id).unwrap();
    let juror = dispute.panel.get(0).unwrap();

    let s = salt(&f.env, 1);
    let commitment = make_commitment(&f.env, dispute_id, true, &s);
    f.client.commit_vote(&dispute_id, &juror, &commitment);

    set_ledger(
        &f.env,
        START_TS + crate::COMMIT_WINDOW_SECONDS + 1,
        START_SEQ,
    );
    let wrong_salt = salt(&f.env, 99);
    let result = f
        .client
        .try_reveal_vote(&dispute_id, &juror, &true, &wrong_salt);
    assert_eq!(
        result.err(),
        contract_error(ArbitrationError::CommitmentMismatch)
    );

    // The vote must still be unrevealed -- a mismatch does not silently pass.
    let vote = f.client.get_vote(&dispute_id, &juror).unwrap();
    assert!(!vote.revealed);
}

#[test]
fn double_reveal_rejected() {
    let f = setup();
    join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);
    let dispute = f.client.get_dispute(&dispute_id).unwrap();
    let juror = dispute.panel.get(0).unwrap();

    let s = salt(&f.env, 1);
    let commitment = make_commitment(&f.env, dispute_id, true, &s);
    f.client.commit_vote(&dispute_id, &juror, &commitment);

    set_ledger(
        &f.env,
        START_TS + crate::COMMIT_WINDOW_SECONDS + 1,
        START_SEQ,
    );
    f.client.reveal_vote(&dispute_id, &juror, &true, &s);

    let result = f.client.try_reveal_vote(&dispute_id, &juror, &true, &s);
    assert_eq!(
        result.err(),
        contract_error(ArbitrationError::AlreadyRevealed)
    );
}

// ---------------------------------------------------------------------------
// resolve: happy paths
// ---------------------------------------------------------------------------

#[test]
fn resolve_releases_on_majority_favorable_vote() {
    let f = setup();
    join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);
    let dispute = f.client.get_dispute(&dispute_id).unwrap();
    let panel = dispute.panel.clone();

    // 4 of 5 vote to release.
    commit_and_reveal(&f, dispute_id, &panel, 4);

    let scholar_balance_before = f.token.balance(&f.scholar);
    f.client.resolve(&dispute_id);

    let resolved = f.client.get_dispute(&dispute_id).unwrap();
    assert_eq!(resolved.outcome, Some(true));
    assert_eq!(
        f.client.get_release_outcome(&dispute_id),
        Some((1u32, 1u32, true))
    );

    // Scholar gets their own stake back.
    assert!(f.token.balance(&f.scholar) >= scholar_balance_before + SCHOLAR_DISPUTE_STAKE);
}

#[test]
fn resolve_upholds_rejection_on_majority_against() {
    let f = setup();
    join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);
    let dispute = f.client.get_dispute(&dispute_id).unwrap();
    let panel = dispute.panel.clone();

    // Only 1 of 5 votes to release; rejection is upheld.
    commit_and_reveal(&f, dispute_id, &panel, 1);

    let treasury_balance_before = f.token.balance(&f.treasury);
    f.client.resolve(&dispute_id);

    let resolved = f.client.get_dispute(&dispute_id).unwrap();
    assert_eq!(resolved.outcome, Some(false));
    assert_eq!(
        f.client.get_release_outcome(&dispute_id),
        Some((1u32, 1u32, false))
    );

    // The scholar's forfeited stake's non-majority share lands at the
    // treasury (the "winning party" when the rejection is upheld).
    assert!(f.token.balance(&f.treasury) > treasury_balance_before);
}

#[test]
fn resolve_slashes_minority_and_rewards_majority() {
    let f = setup();
    join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);
    let dispute = f.client.get_dispute(&dispute_id).unwrap();
    let panel = dispute.panel.clone();

    // 4-for-release, 1-against: the single "against" voter is the minority.
    commit_and_reveal(&f, dispute_id, &panel, 4);
    let minority_juror = panel.get(4).unwrap();

    f.client.resolve(&dispute_id);

    let expected_slash = (MIN_JUROR_STAKE * (MINORITY_SLASH_BPS as i128)) / BPS_DENOMINATOR;
    assert_eq!(
        f.client.get_juror_stake(&minority_juror),
        MIN_JUROR_STAKE - expected_slash
    );

    // Majority jurors end up with at least their original stake back (their
    // share of the redistributed slash pool is >= 0).
    let majority_juror = panel.get(0).unwrap();
    assert!(f.client.get_juror_stake(&majority_juror) >= MIN_JUROR_STAKE);
}

#[test]
fn resolve_slashes_non_revealer_in_full() {
    let f = setup();
    join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);
    let dispute = f.client.get_dispute(&dispute_id).unwrap();
    let panel = dispute.panel.clone();

    // 4 jurors commit and reveal (3-for, 1-against); the 5th never commits.
    let silent = panel.get(4).unwrap();
    let voting_panel = take_vec(&f.env, &panel, 4);
    commit_and_reveal(&f, dispute_id, &voting_panel, 3);

    set_ledger(
        &f.env,
        START_TS + crate::COMMIT_WINDOW_SECONDS + crate::REVEAL_WINDOW_SECONDS + 1,
        START_SEQ,
    );
    f.client.resolve(&dispute_id);

    let expected_slash =
        (MIN_JUROR_STAKE * (NON_PARTICIPATION_SLASH_BPS as i128)) / BPS_DENOMINATOR;
    assert_eq!(
        f.client.get_juror_stake(&silent),
        MIN_JUROR_STAKE - expected_slash
    );
}

#[test]
fn resolve_before_deadline_without_full_reveal_fails() {
    let f = setup();
    join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);
    let dispute = f.client.get_dispute(&dispute_id).unwrap();
    let panel = dispute.panel.clone();

    let s = salt(&f.env, 1);
    let commitment = make_commitment(&f.env, dispute_id, true, &s);
    f.client
        .commit_vote(&dispute_id, &panel.get(0).unwrap(), &commitment);

    let result = f.client.try_resolve(&dispute_id);
    assert_eq!(
        result.err(),
        contract_error(ArbitrationError::NotYetResolvable)
    );
}

#[test]
fn resolve_early_when_every_panel_member_has_revealed() {
    let f = setup();
    join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);
    let dispute = f.client.get_dispute(&dispute_id).unwrap();
    let panel = dispute.panel.clone();

    commit_and_reveal(&f, dispute_id, &panel, 5);
    // Still well before reveal_deadline.
    assert!(f.env.ledger().timestamp() < dispute.reveal_deadline);

    f.client.resolve(&dispute_id);
    assert_eq!(
        f.client.get_dispute(&dispute_id).unwrap().outcome,
        Some(true)
    );
}

// ---------------------------------------------------------------------------
// resolve: quorum-failure fallback
// ---------------------------------------------------------------------------

#[test]
fn quorum_failure_upholds_status_quo_and_refunds_scholar() {
    let f = setup();
    join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);
    let dispute = f.client.get_dispute(&dispute_id).unwrap();
    let panel = dispute.panel.clone();

    // Only 2 of 5 reveal -- below QUORUM (3).
    let revealing = take_vec(&f.env, &panel, 2);
    commit_and_reveal(&f, dispute_id, &revealing, 2);

    let scholar_balance_before = f.token.balance(&f.scholar);
    set_ledger(
        &f.env,
        START_TS + crate::COMMIT_WINDOW_SECONDS + crate::REVEAL_WINDOW_SECONDS + 1,
        START_SEQ,
    );
    f.client.resolve(&dispute_id);

    let resolved = f.client.get_dispute(&dispute_id).unwrap();
    assert_eq!(resolved.outcome, None);
    assert_eq!(f.client.get_release_outcome(&dispute_id), None);

    // Scholar refunded in full -- a quorum failure is not their fault.
    assert_eq!(
        f.token.balance(&f.scholar),
        scholar_balance_before + SCHOLAR_DISPUTE_STAKE
    );

    // The 2 revealers kept their stake untouched.
    for juror in revealing.iter() {
        assert_eq!(f.client.get_juror_stake(&juror), MIN_JUROR_STAKE);
    }
    // The 3 silent jurors were slashed in full.
    for juror in panel.iter().skip(2) {
        assert_eq!(f.client.get_juror_stake(&juror), 0);
    }
}

#[test]
fn tie_vote_favors_status_quo() {
    let f = setup();
    // 6 jurors so a 3-3 tie is possible on a panel this large... PANEL_SIZE is
    // fixed at 5, so instead build a panel where reveals land 2-2 with one
    // non-revealer, keeping the tie among revealed votes.
    let jurors = join_default_pool(&f);
    let dispute_id = open_dispute(&f, 1, 1);
    let dispute = f.client.get_dispute(&dispute_id).unwrap();
    let panel = dispute.panel.clone();
    assert_eq!(panel.len(), jurors.len() as u32);

    let voting_panel = take_vec(&f.env, &panel, 4);
    commit_and_reveal(&f, dispute_id, &voting_panel, 2);

    set_ledger(
        &f.env,
        START_TS + crate::COMMIT_WINDOW_SECONDS + crate::REVEAL_WINDOW_SECONDS + 1,
        START_SEQ,
    );
    f.client.resolve(&dispute_id);

    let resolved = f.client.get_dispute(&dispute_id).unwrap();
    // 4 revealed (quorum met), 2-2 tie -> status quo (uphold, no release).
    assert_eq!(resolved.outcome, Some(false));
}

// ---------------------------------------------------------------------------
// panel selection
// ---------------------------------------------------------------------------

#[test]
fn panel_selection_depends_on_ledger_state_not_caller_input() {
    // Same pool, same open_dispute arguments, different ledger sequence at
    // the moment of the draw -> a different panel. Nothing about the
    // `open_dispute` call itself can force a specific outcome.
    let f = setup();
    join_default_pool(&f);
    for _ in 0..5 {
        join_juror(&f, MIN_JUROR_STAKE);
    }

    let dispute_a = open_dispute(&f, 1, 1);
    let panel_a = f.client.get_dispute(&dispute_a).unwrap().panel;

    set_ledger(&f.env, START_TS + 1, START_SEQ + 1);
    let dispute_b = open_dispute(&f, 2, 2);
    let panel_b = f.client.get_dispute(&dispute_b).unwrap().panel;

    assert_ne!(panel_a, panel_b);
}

#[test]
fn selection_weight_is_capped_so_a_whale_cannot_dominate() {
    let f = setup();
    join_default_pool(&f);
    // A juror staking far beyond MAX_JUROR_SELECTION_WEIGHT still only ever
    // occupies a single seat, same as everyone else.
    join_juror(&f, MAX_JUROR_SELECTION_WEIGHT * 100);

    let dispute_id = open_dispute(&f, 1, 1);
    let panel = f.client.get_dispute(&dispute_id).unwrap().panel;
    assert_eq!(panel.len(), PANEL_SIZE);

    let mut seen: std::vec::Vec<Address> = std::vec::Vec::new();
    for juror in panel.iter() {
        assert!(
            !seen.contains(&juror),
            "a whale occupied more than one seat"
        );
        seen.push(juror);
    }
}

// ---------------------------------------------------------------------------
// benchmarks
// ---------------------------------------------------------------------------

#[test]
fn benchmark_costs() {
    let f = setup();
    join_default_pool(&f);

    f.env.cost_estimate().budget().reset_unlimited();
    let dispute_id = open_dispute(&f, 1, 1);
    let open_instr = f.env.cost_estimate().budget().cpu_instruction_cost();

    let dispute = f.client.get_dispute(&dispute_id).unwrap();
    let panel = dispute.panel.clone();
    let s = salt(&f.env, 1);
    let commitment = make_commitment(&f.env, dispute_id, true, &s);

    f.env.cost_estimate().budget().reset_unlimited();
    f.client
        .commit_vote(&dispute_id, &panel.get(0).unwrap(), &commitment);
    let commit_instr = f.env.cost_estimate().budget().cpu_instruction_cost();

    for (i, juror) in panel.iter().enumerate().skip(1) {
        let s_i = salt(&f.env, i as u8 + 1);
        let commitment_i = make_commitment(&f.env, dispute_id, i % 2 == 0, &s_i);
        f.client.commit_vote(&dispute_id, &juror, &commitment_i);
    }

    set_ledger(
        &f.env,
        START_TS + crate::COMMIT_WINDOW_SECONDS + 1,
        START_SEQ,
    );
    f.env.cost_estimate().budget().reset_unlimited();
    f.client
        .reveal_vote(&dispute_id, &panel.get(0).unwrap(), &true, &s);
    let reveal_instr = f.env.cost_estimate().budget().cpu_instruction_cost();

    for (i, juror) in panel.iter().enumerate().skip(1) {
        let s_i = salt(&f.env, i as u8 + 1);
        f.client
            .reveal_vote(&dispute_id, &juror, &(i % 2 == 0), &s_i);
    }

    f.env.cost_estimate().budget().reset_unlimited();
    f.client.resolve(&dispute_id);
    let resolve_instr = f.env.cost_estimate().budget().cpu_instruction_cost();

    std::println!("BENCHMARK_RESULTS: milestone_arbitration");
    std::println!("open_dispute: instr={}", open_instr);
    std::println!("commit_vote: instr={}", commit_instr);
    std::println!("reveal_vote: instr={}", reveal_instr);
    std::println!("resolve: instr={}", resolve_instr);
}
