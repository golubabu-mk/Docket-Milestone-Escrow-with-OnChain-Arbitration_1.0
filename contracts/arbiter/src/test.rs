#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Env, String};

fn setup(env: &Env) -> (ArbiterContractClient<'static>, Address) {
    let contract_id = env.register_contract(None, ArbiterContract);
    let client = ArbiterContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.init_arbiter(&admin);
    (client, admin)
}

#[test]
fn test_initialize_sets_admin_as_arbiter() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    assert!(client.is_arbiter(&admin));
}

#[test]
fn test_cannot_initialize_twice() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let result = client.try_init_arbiter(&admin);
    assert_eq!(result, Err(Ok(ArbiterError::AlreadyInitialized)));
}

#[test]
fn test_add_arbiter() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let new_arbiter = Address::generate(&env);

    assert!(!client.is_arbiter(&new_arbiter));
    client.add_arbiter(&admin, &new_arbiter);
    assert!(client.is_arbiter(&new_arbiter));
}

#[test]
fn test_non_admin_cannot_add_arbiter() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);
    let impostor = Address::generate(&env);
    let new_arbiter = Address::generate(&env);

    let result = client.try_add_arbiter(&impostor, &new_arbiter);
    assert_eq!(result, Err(Ok(ArbiterError::Unauthorized)));
}

#[test]
fn test_raise_and_resolve_dispute_flow() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let escrow_contract = Address::generate(&env);
    let freelancer = Address::generate(&env);
    let job_id: u64 = 1;
    let reason = String::from_str(&env, "Milestone was not delivered as agreed");

    client.arb_raise_dispute(&escrow_contract, &job_id, &freelancer, &reason);

    let dispute = client.get_dispute(&escrow_contract, &job_id).unwrap();
    assert_eq!(dispute.status, DisputeStatus::Open);
    assert_eq!(dispute.raised_by, freelancer);

    let outcome = client.resolve_dispute(
        &admin,
        &escrow_contract,
        &job_id,
        &DisputeStatus::Split,
    );
    assert_eq!(outcome, DisputeStatus::Split);

    let resolved = client.get_dispute(&escrow_contract, &job_id).unwrap();
    assert_eq!(resolved.status, DisputeStatus::Split);
    assert_eq!(resolved.resolved_by, Some(admin));
}

#[test]
fn test_cannot_raise_dispute_twice_while_open() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);

    let escrow_contract = Address::generate(&env);
    let client_addr = Address::generate(&env);
    let job_id: u64 = 7;
    let reason = String::from_str(&env, "Scope disagreement");

    client.arb_raise_dispute(&escrow_contract, &job_id, &client_addr, &reason);
    let result = client.try_arb_raise_dispute(&escrow_contract, &job_id, &client_addr, &reason);
    assert_eq!(result, Err(Ok(ArbiterError::DisputeAlreadyOpen)));
}

#[test]
fn test_non_arbiter_cannot_resolve() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);

    let escrow_contract = Address::generate(&env);
    let raiser = Address::generate(&env);
    let impostor = Address::generate(&env);
    let job_id: u64 = 3;
    let reason = String::from_str(&env, "Quality dispute");

    client.arb_raise_dispute(&escrow_contract, &job_id, &raiser, &reason);
    let result = client.try_resolve_dispute(&impostor, &escrow_contract, &job_id, &DisputeStatus::ResolvedForClient);
    assert_eq!(result, Err(Ok(ArbiterError::NotAnArbiter)));
}

#[test]
fn test_cannot_resolve_already_resolved_dispute() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let escrow_contract = Address::generate(&env);
    let raiser = Address::generate(&env);
    let job_id: u64 = 9;
    let reason = String::from_str(&env, "Payment timing dispute");

    client.arb_raise_dispute(&escrow_contract, &job_id, &raiser, &reason);
    client.resolve_dispute(&admin, &escrow_contract, &job_id, &DisputeStatus::ResolvedForFreelancer);

    let result = client.try_resolve_dispute(&admin, &escrow_contract, &job_id, &DisputeStatus::ResolvedForClient);
    assert_eq!(result, Err(Ok(ArbiterError::DisputeAlreadyResolved)));
}

#[test]
fn test_get_dispute_returns_none_when_missing() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);
    let escrow_contract = Address::generate(&env);
    assert!(client.get_dispute(&escrow_contract, &42).is_none());
}
