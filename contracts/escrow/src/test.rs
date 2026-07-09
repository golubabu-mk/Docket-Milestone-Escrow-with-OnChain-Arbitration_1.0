#![cfg(test)]

use super::*;
use arbiter_contract::{ArbiterContract, DisputeStatus as ArbDisputeStatus};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::token::StellarAssetClient;
use soroban_sdk::{vec, Address, Env, String, Vec};

struct TestSetup {
    env: Env,
    escrow_id: Address,
    escrow: EscrowContractClient<'static>,
    token: Address,
    arbiter_id: Address,
    arbiter_admin: Address,
    client_addr: Address,
    freelancer: Address,
}

fn setup() -> TestSetup {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy a real Stellar Asset Contract test token so transfers behave
    // exactly like they would with a live SEP-41 token on testnet/mainnet.
    let token_admin_addr = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin_addr.clone());
    let token = sac.address();
    let token_admin = StellarAssetClient::new(&env, &token);

    let arbiter_id = env.register(ArbiterContract, ());
    let arbiter_admin = Address::generate(&env);
    arbiter_contract::ArbiterContractClient::new(&env, &arbiter_id).init_arbiter(&arbiter_admin);

    let escrow_id = env.register(EscrowContract, ());
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    escrow.initialize(&arbiter_id);

    let client_addr = Address::generate(&env);
    let freelancer = Address::generate(&env);
    token_admin.mint(&client_addr, &10_000);

    TestSetup {
        env,
        escrow_id,
        escrow,
        token,
        arbiter_id,
        arbiter_admin,
        client_addr,
        freelancer,
    }
}

fn milestones(env: &Env, items: &[(&str, i128)]) -> (Vec<String>, Vec<i128>) {
    let mut descs = Vec::new(env);
    let mut amounts = Vec::new(env);
    for (d, a) in items {
        descs.push_back(String::from_str(env, d));
        amounts.push_back(*a);
    }
    (descs, amounts)
}

#[test]
fn test_create_job_transfers_funds_into_escrow() {
    let t = setup();
    let (descs, amounts) = milestones(&t.env, &[("Design mockups", 300), ("Build MVP", 700)]);

    let job_id = t.escrow.create_job(&t.client_addr, &t.freelancer, &t.token, &descs, &amounts);
    assert_eq!(job_id, 0);

    let token_client = token::Client::new(&t.env, &t.token);
    assert_eq!(token_client.balance(&t.escrow_id), 1000);
    assert_eq!(token_client.balance(&t.client_addr), 9000);

    let job = t.escrow.get_job(&job_id);
    assert_eq!(job.status, JobStatus::Active);
    assert_eq!(job.funded_amount, 1000);
    assert_eq!(job.milestones.len(), 2);
}

#[test]
fn test_full_milestone_lifecycle_releases_funds() {
    let t = setup();
    let (descs, amounts) = milestones(&t.env, &[("Design mockups", 300), ("Build MVP", 700)]);
    let job_id = t.escrow.create_job(&t.client_addr, &t.freelancer, &t.token, &descs, &amounts);

    t.escrow.submit_milestone(&t.freelancer, &job_id, &0);
    let job = t.escrow.get_job(&job_id);
    assert_eq!(job.milestones.get(0).unwrap().status, MilestoneStatus::Submitted);

    t.escrow.approve_and_release(&t.client_addr, &job_id, &0);

    let token_client = token::Client::new(&t.env, &t.token);
    assert_eq!(token_client.balance(&t.freelancer), 300);

    let job = t.escrow.get_job(&job_id);
    assert_eq!(job.milestones.get(0).unwrap().status, MilestoneStatus::Released);
    assert_eq!(job.status, JobStatus::Active); // second milestone still pending

    t.escrow.submit_milestone(&t.freelancer, &job_id, &1);
    t.escrow.approve_and_release(&t.client_addr, &job_id, &1);

    assert_eq!(token_client.balance(&t.freelancer), 1000);
    let job = t.escrow.get_job(&job_id);
    assert_eq!(job.status, JobStatus::Completed);
}

#[test]
fn test_cannot_approve_milestone_not_yet_submitted() {
    let t = setup();
    let (descs, amounts) = milestones(&t.env, &[("Design mockups", 500)]);
    let job_id = t.escrow.create_job(&t.client_addr, &t.freelancer, &t.token, &descs, &amounts);

    let result = t.escrow.try_approve_and_release(&t.client_addr, &job_id, &0);
    assert_eq!(result, Err(Ok(EscrowError::InvalidMilestoneStatus)));
}

#[test]
fn test_only_freelancer_can_submit_milestone() {
    let t = setup();
    let (descs, amounts) = milestones(&t.env, &[("Design mockups", 500)]);
    let job_id = t.escrow.create_job(&t.client_addr, &t.freelancer, &t.token, &descs, &amounts);

    let impostor = Address::generate(&t.env);
    let result = t.escrow.try_submit_milestone(&impostor, &job_id, &0);
    assert_eq!(result, Err(Ok(EscrowError::Unauthorized)));
}

#[test]
fn test_only_client_can_approve_milestone() {
    let t = setup();
    let (descs, amounts) = milestones(&t.env, &[("Design mockups", 500)]);
    let job_id = t.escrow.create_job(&t.client_addr, &t.freelancer, &t.token, &descs, &amounts);
    t.escrow.submit_milestone(&t.freelancer, &job_id, &0);

    let impostor = Address::generate(&t.env);
    let result = t.escrow.try_approve_and_release(&impostor, &job_id, &0);
    assert_eq!(result, Err(Ok(EscrowError::Unauthorized)));
}

#[test]
fn test_invalid_milestone_index_rejected() {
    let t = setup();
    let (descs, amounts) = milestones(&t.env, &[("Design mockups", 500)]);
    let job_id = t.escrow.create_job(&t.client_addr, &t.freelancer, &t.token, &descs, &amounts);

    let result = t.escrow.try_submit_milestone(&t.freelancer, &job_id, &5);
    assert_eq!(result, Err(Ok(EscrowError::InvalidMilestoneIndex)));
}

#[test]
fn test_create_job_rejects_empty_milestones() {
    let t = setup();
    let descs: Vec<String> = Vec::new(&t.env);
    let amounts: Vec<i128> = Vec::new(&t.env);

    let result = t.escrow.try_create_job(&t.client_addr, &t.freelancer, &t.token, &descs, &amounts);
    assert_eq!(result, Err(Ok(EscrowError::NoMilestonesProvided)));
}

#[test]
fn test_create_job_rejects_non_positive_amount() {
    let t = setup();
    let (descs, amounts) = milestones(&t.env, &[("Bad milestone", 0)]);
    let result = t.escrow.try_create_job(&t.client_addr, &t.freelancer, &t.token, &descs, &amounts);
    assert_eq!(result, Err(Ok(EscrowError::InvalidAmount)));
}

#[test]
fn test_dispute_flow_end_to_end_split_outcome() {
    let t = setup();
    let (descs, amounts) = milestones(&t.env, &[("Design mockups", 300), ("Build MVP", 700)]);
    let job_id = t.escrow.create_job(&t.client_addr, &t.freelancer, &t.token, &descs, &amounts);

    t.escrow.submit_milestone(&t.freelancer, &job_id, &0);
    t.escrow.approve_and_release(&t.client_addr, &job_id, &0);

    let reason = String::from_str(&t.env, "Freelancer says MVP is done, client disagrees");
    t.escrow.raise_dispute(&t.freelancer, &job_id, &reason);

    let job = t.escrow.get_job(&job_id);
    assert_eq!(job.status, JobStatus::Disputed);

    let arbiter_client = arbiter_contract::ArbiterContractClient::new(&t.env, &t.arbiter_id);
    arbiter_client.resolve_dispute(&t.arbiter_admin, &t.escrow_id, &job_id, &ArbDisputeStatus::Split);

    let outcome = t.escrow.settle_dispute(&job_id);
    assert_eq!(outcome, ArbDisputeStatus::Split);

    let token_client = token::Client::new(&t.env, &t.token);
    // 700 remaining, split down the middle (350/350)
    assert_eq!(token_client.balance(&t.freelancer), 300 + 350);
    assert_eq!(token_client.balance(&t.client_addr), 10_000 - 1000 + 350);

    let job = t.escrow.get_job(&job_id);
    assert_eq!(job.status, JobStatus::Completed);
}

#[test]
fn test_cannot_dispute_twice() {
    let t = setup();
    let (descs, amounts) = milestones(&t.env, &[("Design mockups", 500)]);
    let job_id = t.escrow.create_job(&t.client_addr, &t.freelancer, &t.token, &descs, &amounts);

    let reason = String::from_str(&t.env, "Disagreement about scope");
    t.escrow.raise_dispute(&t.client_addr, &job_id, &reason);

    let result = t.escrow.try_raise_dispute(&t.freelancer, &job_id, &reason);
    assert_eq!(result, Err(Ok(EscrowError::JobAlreadyDisputed)));
}

#[test]
fn test_unrelated_party_cannot_raise_dispute() {
    let t = setup();
    let (descs, amounts) = milestones(&t.env, &[("Design mockups", 500)]);
    let job_id = t.escrow.create_job(&t.client_addr, &t.freelancer, &t.token, &descs, &amounts);

    let stranger = Address::generate(&t.env);
    let reason = String::from_str(&t.env, "I want in on this dispute");
    let result = t.escrow.try_raise_dispute(&stranger, &job_id, &reason);
    assert_eq!(result, Err(Ok(EscrowError::Unauthorized)));
}

#[test]
fn test_get_job_not_found() {
    let t = setup();
    let result = t.escrow.try_get_job(&999);
    assert_eq!(result, Err(Ok(EscrowError::JobNotFound)));
}

#[test]
fn test_multiple_jobs_have_independent_ids() {
    let t = setup();
    let (descs1, amounts1) = milestones(&t.env, &[("Job A milestone", 100)]);
    let (descs2, amounts2) = milestones(&t.env, &[("Job B milestone", 200)]);

    let job_id_1 = t.escrow.create_job(&t.client_addr, &t.freelancer, &t.token, &descs1, &amounts1);
    let job_id_2 = t.escrow.create_job(&t.client_addr, &t.freelancer, &t.token, &descs2, &amounts2);

    assert_eq!(job_id_1, 0);
    assert_eq!(job_id_2, 1);

    let _ = vec![&t.env, job_id_1, job_id_2];
}
