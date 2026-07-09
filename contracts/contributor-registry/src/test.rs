#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Env;

fn setup() -> (Env, ContributorRegistryClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, ContributorRegistry);
    let client = ContributorRegistryClient::new(&env, &contract_id);

    client.initialize(&admin);

    let writer = Address::generate(&env);
    client.authorize_writer(&writer);

    (env, client, admin, writer)
}

#[test]
fn test_initialize_sets_admin_once() {
    let (env, client, _admin, _writer) = setup();
    let another_admin = Address::generate(&env);
    let result = client.try_initialize(&another_admin);
    assert!(result.is_err());
}

#[test]
fn test_new_contributor_starts_at_baseline_score() {
    let (env, client, _admin, _writer) = setup();
    let contributor = Address::generate(&env);

    let stats = client.get_stats(&contributor);
    assert_eq!(stats.reputation_score, 500);
    assert_eq!(stats.completed_bounties, 0);
    assert_eq!(stats.total_earned, 0);
}

#[test]
fn test_record_completion_increases_score_and_earnings() {
    let (env, client, _admin, writer) = setup();
    let contributor = Address::generate(&env);

    let stats = client.record_completion(&writer, &contributor, &2_500_i128);

    assert_eq!(stats.completed_bounties, 1);
    assert_eq!(stats.total_earned, 2_500);
    assert_eq!(stats.reputation_score, 515);

    let stats2 = client.record_completion(&writer, &contributor, &1_000_i128);
    assert_eq!(stats2.completed_bounties, 2);
    assert_eq!(stats2.total_earned, 3_500);
    assert_eq!(stats2.reputation_score, 530);
}

#[test]
fn test_record_completion_rejects_unauthorized_caller() {
    let (env, client, _admin, _writer) = setup();
    let contributor = Address::generate(&env);
    let rogue = Address::generate(&env);

    let result = client.try_record_completion(&rogue, &contributor, &1_000_i128);
    assert!(result.is_err());
}

#[test]
fn test_record_completion_rejects_zero_or_negative_amount() {
    let (env, client, _admin, writer) = setup();
    let contributor = Address::generate(&env);

    let result = client.try_record_completion(&writer, &contributor, &0_i128);
    assert!(result.is_err());

    let result_neg = client.try_record_completion(&writer, &contributor, &(-5_i128));
    assert!(result_neg.is_err());
}

#[test]
fn test_record_dispute_penalizes_score() {
    let (env, client, _admin, writer) = setup();
    let contributor = Address::generate(&env);

    client.record_completion(&writer, &contributor, &1_000_i128); // score 515
    let stats = client.record_dispute(&writer, &contributor);

    assert_eq!(stats.disputes_lost, 1);
    assert_eq!(stats.reputation_score, 455); // 515 - 60
}

#[test]
fn test_score_never_exceeds_max() {
    let (env, client, _admin, writer) = setup();
    let contributor = Address::generate(&env);

    // 500 start, +15 each; 40 completions would exceed 1000 without the cap
    for _ in 0..40 {
        client.record_completion(&writer, &contributor, &10_i128);
    }
    let stats = client.get_stats(&contributor);
    assert_eq!(stats.reputation_score, 1000);
}

#[test]
fn test_tier_labels_reflect_score_bands() {
    let (env, client, _admin, writer) = setup();
    let newbie = Address::generate(&env);
    assert_eq!(
        client.tier_label(&newbie),
        String::from_str(&env, "Trusted")
    );

    let veteran = Address::generate(&env);
    for _ in 0..10 {
        client.record_completion(&writer, &veteran, &10_i128);
    }
    // 500 + 150 = 650 -> Veteran
    assert_eq!(
        client.tier_label(&veteran),
        String::from_str(&env, "Veteran")
    );
}
