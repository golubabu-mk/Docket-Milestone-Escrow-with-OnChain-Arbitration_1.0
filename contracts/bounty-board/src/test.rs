#![cfg(test)]

use super::*;
use contributor_registry::ContributorRegistry;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Env;

fn create_token_contract<'a>(
    env: &Env,
    admin: &Address,
) -> (Address, token::StellarAssetClient<'a>, token::Client<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let address = sac.address();
    let asset_client = token::StellarAssetClient::new(env, &address);
    let client = token::Client::new(env, &address);
    (address, asset_client, client)
}

struct TestSetup<'a> {
    env: Env,
    board: BountyBoardClient<'a>,
    registry: contributor_registry::ContributorRegistryClient<'a>,
    token: token::Client<'a>,
    token_admin: token::StellarAssetClient<'a>,
    sponsor: Address,
}

fn setup<'a>() -> TestSetup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sponsor = Address::generate(&env);

    let (token_address, token_admin, token) = create_token_contract(&env, &admin);
    token_admin.mint(&sponsor, &1_000_000_i128);

    let registry_id = env.register(ContributorRegistry, ());
    let registry = contributor_registry::ContributorRegistryClient::new(&env, &registry_id);
    registry.initialize(&admin);

    let board_id = env.register(BountyBoard, ());
    let board = BountyBoardClient::new(&env, &board_id);
    board.initialize(&admin, &token_address, &registry_id);

    // Authorize the deployed BountyBoard as a writer on the registry —
    // this is the trust link that makes the cross-contract call secure.
    registry.authorize_writer(&board_id);

    TestSetup {
        env,
        board,
        registry,
        token,
        token_admin: token_admin,
        sponsor,
    }
}

#[test]
fn test_post_bounty_escrows_funds() {
    let s = setup();
    let title = String::from_str(&s.env, "Build a landing page");
    let desc = String::from_str(&s.env, "React + Tailwind, mobile responsive");

    let id = s.board.post_bounty(&s.sponsor, &title, &desc, &5_000_i128);

    assert_eq!(id, 0);
    assert_eq!(s.token.balance(&s.sponsor), 995_000);
    assert_eq!(s.token.balance(&s.board.address), 5_000);

    let bounty = s.board.get_bounty(&id);
    assert_eq!(bounty.status, BountyStatus::Open);
    assert_eq!(bounty.reward, 5_000);
}

#[test]
fn test_post_bounty_rejects_non_positive_reward() {
    let s = setup();
    let title = String::from_str(&s.env, "Bad bounty");
    let desc = String::from_str(&s.env, "desc");
    let result = s.board.try_post_bounty(&s.sponsor, &title, &desc, &0_i128);
    assert!(result.is_err());
}

#[test]
fn test_full_lifecycle_submit_approve_pay_updates_reputation() {
    let s = setup();
    let contributor = Address::generate(&s.env);

    let title = String::from_str(&s.env, "Design a logo");
    let desc = String::from_str(&s.env, "Vector logo, 3 concepts");
    let id = s.board.post_bounty(&s.sponsor, &title, &desc, &2_000_i128);

    let note = String::from_str(&s.env, "Delivered 3 concepts, Figma link attached");
    s.board.submit_work(&id, &contributor, &note);

    let bounty = s.board.get_bounty(&id);
    assert_eq!(bounty.status, BountyStatus::Submitted);
    assert_eq!(bounty.contributor, Some(contributor.clone()));

    s.board.approve_and_pay(&id, &s.sponsor);

    // Funds released to contributor
    assert_eq!(s.token.balance(&contributor), 2_000);
    assert_eq!(s.token.balance(&s.board.address), 0);

    let paid_bounty = s.board.get_bounty(&id);
    assert_eq!(paid_bounty.status, BountyStatus::Paid);

    // Cross-contract effect: reputation registry updated
    let stats = s.registry.get_stats(&contributor);
    assert_eq!(stats.completed_bounties, 1);
    assert_eq!(stats.total_earned, 2_000);
    assert_eq!(stats.reputation_score, 515);
}

#[test]
fn test_submit_work_requires_open_status() {
    let s = setup();
    let contributor = Address::generate(&s.env);
    let title = String::from_str(&s.env, "Task");
    let desc = String::from_str(&s.env, "desc");
    let id = s.board.post_bounty(&s.sponsor, &title, &desc, &1_000_i128);

    let note = String::from_str(&s.env, "done");
    s.board.submit_work(&id, &contributor, &note);

    let second = Address::generate(&s.env);
    let result = s.board.try_submit_work(&id, &second, &note);
    assert!(result.is_err());
}

#[test]
fn test_only_sponsor_can_approve() {
    let s = setup();
    let contributor = Address::generate(&s.env);
    let stranger = Address::generate(&s.env);
    let title = String::from_str(&s.env, "Task");
    let desc = String::from_str(&s.env, "desc");
    let id = s.board.post_bounty(&s.sponsor, &title, &desc, &1_000_i128);
    let note = String::from_str(&s.env, "done");
    s.board.submit_work(&id, &contributor, &note);

    let result = s.board.try_approve_and_pay(&id, &stranger);
    assert!(result.is_err());
}

#[test]
fn test_dispute_then_cancel_refunds_sponsor_and_penalizes_contributor() {
    let s = setup();
    let contributor = Address::generate(&s.env);
    let title = String::from_str(&s.env, "Task");
    let desc = String::from_str(&s.env, "desc");
    let id = s.board.post_bounty(&s.sponsor, &title, &desc, &3_000_i128);
    let note = String::from_str(&s.env, "low effort submission");
    s.board.submit_work(&id, &contributor, &note);

    s.board.dispute_submission(&id, &s.sponsor);
    let disputed = s.board.get_bounty(&id);
    assert_eq!(disputed.status, BountyStatus::Disputed);

    let sponsor_balance_before = s.token.balance(&s.sponsor);
    s.board.cancel_disputed(&id, &s.sponsor);

    assert_eq!(s.token.balance(&s.sponsor), sponsor_balance_before + 3_000);
    let cancelled = s.board.get_bounty(&id);
    assert_eq!(cancelled.status, BountyStatus::Cancelled);

    let stats = s.registry.get_stats(&contributor);
    assert_eq!(stats.disputes_lost, 1);
    assert_eq!(stats.reputation_score, 440); // 500 - 60
}

#[test]
fn test_dispute_can_still_be_approved_and_paid() {
    let s = setup();
    let contributor = Address::generate(&s.env);
    let title = String::from_str(&s.env, "Task");
    let desc = String::from_str(&s.env, "desc");
    let id = s.board.post_bounty(&s.sponsor, &title, &desc, &1_500_i128);
    let note = String::from_str(&s.env, "revised submission after feedback");
    s.board.submit_work(&id, &contributor, &note);
    s.board.dispute_submission(&id, &s.sponsor);

    // Sponsor reconsiders and approves anyway
    s.board.approve_and_pay(&id, &s.sponsor);

    assert_eq!(s.token.balance(&contributor), 1_500);
    let bounty = s.board.get_bounty(&id);
    assert_eq!(bounty.status, BountyStatus::Paid);
}

#[test]
fn test_cancel_open_bounty_refunds_sponsor() {
    let s = setup();
    let title = String::from_str(&s.env, "Unclaimed task");
    let desc = String::from_str(&s.env, "desc");
    let id = s.board.post_bounty(&s.sponsor, &title, &desc, &750_i128);

    let balance_before = s.token.balance(&s.sponsor);
    s.board.cancel_open(&id, &s.sponsor);

    assert_eq!(s.token.balance(&s.sponsor), balance_before + 750);
    let bounty = s.board.get_bounty(&id);
    assert_eq!(bounty.status, BountyStatus::Cancelled);
}

#[test]
fn test_list_bounties_pagination() {
    let s = setup();
    for i in 0..5 {
        let title = String::from_str(&s.env, "Task");
        let desc = String::from_str(&s.env, "desc");
        s.board.post_bounty(&s.sponsor, &title, &desc, &(100 + i));
    }
    assert_eq!(s.board.bounty_count(), 5);

    let page1 = s.board.list_bounties(&0, &3);
    assert_eq!(page1.len(), 3);

    let page2 = s.board.list_bounties(&3, &3);
    assert_eq!(page2.len(), 2);
}

#[test]
fn test_unauthorized_writer_cannot_forge_reputation() {
    let s = setup();
    let contributor = Address::generate(&s.env);
    let rogue_contract = Address::generate(&s.env);

    let result = s
        .registry
        .try_record_completion(&rogue_contract, &contributor, &999_i128);
    assert!(result.is_err());
}
