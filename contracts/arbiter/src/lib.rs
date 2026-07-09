//! Arbiter Contract
//!
//! A standalone dispute-resolution contract. The Escrow contract calls into
//! this contract whenever a dispute is raised or resolved. Keeping this as a
//! separate contract (rather than folding the logic into Escrow) is what lets
//! a single arbiter panel service many independent escrow contracts, and is
//! the piece of this project that demonstrates real inter-contract calls on
//! Soroban.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DisputeStatus {
    None,
    Open,
    ResolvedForClient,
    ResolvedForFreelancer,
    Split,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Dispute {
    pub escrow_contract: Address,
    pub job_id: u64,
    pub raised_by: Address,
    pub reason: String,
    pub status: DisputeStatus,
    pub resolved_by: Option<Address>,
}

#[contracttype]
pub enum DataKey {
    Admin,
    ArbiterPanel,
    Dispute(Address, u64), // (escrow_contract, job_id) -> Dispute
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ArbiterError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAnArbiter = 3,
    DisputeAlreadyOpen = 4,
    DisputeNotFound = 5,
    DisputeAlreadyResolved = 6,
    Unauthorized = 7,
}

#[contract]
pub struct ArbiterContract;

#[contractimpl]
impl ArbiterContract {
    /// One-time setup. `admin` can add/remove arbiters from the panel.
    pub fn init_arbiter(env: Env, admin: Address) -> Result<(), ArbiterError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ArbiterError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        // Admin is automatically a trusted arbiter.
        let mut panel: Vec<Address> = Vec::new(&env);
        panel.push_back(admin.clone());
        env.storage().instance().set(&DataKey::ArbiterPanel, &panel);
        Ok(())
    }

    /// Admin adds a new address to the trusted arbiter panel.
    pub fn add_arbiter(env: Env, admin: Address, new_arbiter: Address) -> Result<(), ArbiterError> {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ArbiterError::NotInitialized)?;
        if stored_admin != admin {
            return Err(ArbiterError::Unauthorized);
        }
        let mut panel: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::ArbiterPanel)
            .unwrap_or(Vec::new(&env));
        if !panel.contains(&new_arbiter) {
            panel.push_back(new_arbiter.clone());
        }
        env.storage().instance().set(&DataKey::ArbiterPanel, &panel);

        env.events().publish(
            (symbol_short!("arbiter"), symbol_short!("added")),
            new_arbiter,
        );
        Ok(())
    }

    /// Called by the Escrow contract (via cross-contract call) when a party
    /// raises a dispute on a specific job.
    pub fn arb_raise_dispute(
        env: Env,
        escrow_contract: Address,
        job_id: u64,
        raised_by: Address,
        reason: String,
    ) -> Result<(), ArbiterError> {
        raised_by.require_auth();

        let key = DataKey::Dispute(escrow_contract.clone(), job_id);
        if let Some(existing) = env.storage().persistent().get::<_, Dispute>(&key) {
            if existing.status == DisputeStatus::Open {
                return Err(ArbiterError::DisputeAlreadyOpen);
            }
        }

        let dispute = Dispute {
            escrow_contract: escrow_contract.clone(),
            job_id,
            raised_by: raised_by.clone(),
            reason: reason.clone(),
            status: DisputeStatus::Open,
            resolved_by: None,
        };
        env.storage().persistent().set(&key, &dispute);

        env.events().publish(
            (symbol_short!("dispute"), symbol_short!("raised"), escrow_contract),
            (job_id, raised_by, reason),
        );

        Ok(())
    }

    /// A panel arbiter resolves an open dispute. Returns the outcome so the
    /// calling Escrow contract knows how to split funds.
    pub fn resolve_dispute(
        env: Env,
        arbiter: Address,
        escrow_contract: Address,
        job_id: u64,
        outcome: DisputeStatus,
    ) -> Result<DisputeStatus, ArbiterError> {
        arbiter.require_auth();

        let panel: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::ArbiterPanel)
            .ok_or(ArbiterError::NotInitialized)?;
        if !panel.contains(&arbiter) {
            return Err(ArbiterError::NotAnArbiter);
        }

        let key = DataKey::Dispute(escrow_contract.clone(), job_id);
        let mut dispute: Dispute = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(ArbiterError::DisputeNotFound)?;

        if dispute.status != DisputeStatus::Open {
            return Err(ArbiterError::DisputeAlreadyResolved);
        }

        dispute.status = outcome.clone();
        dispute.resolved_by = Some(arbiter.clone());
        env.storage().persistent().set(&key, &dispute);

        env.events().publish(
            (symbol_short!("dispute"), symbol_short!("resolved"), escrow_contract),
            (job_id, arbiter, outcome.clone()),
        );

        Ok(outcome)
    }

    /// View function: fetch the current status of a dispute.
    pub fn get_dispute(env: Env, escrow_contract: Address, job_id: u64) -> Option<Dispute> {
        env.storage()
            .persistent()
            .get(&DataKey::Dispute(escrow_contract, job_id))
    }

    pub fn is_arbiter(env: Env, address: Address) -> bool {
        let panel: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::ArbiterPanel)
            .unwrap_or(Vec::new(&env));
        panel.contains(&address)
    }
}

mod test;
