//! Milestone Escrow Contract
//!
//! A freelance/gig payment contract. A Client funds a Job with one or more
//! Milestones. The Freelancer marks milestones complete; the Client approves
//! them, which triggers a real token transfer (a cross-contract call into
//! the deployed Stellar Asset Contract / SEP-41 token). Either side can
//! escalate to the separate Arbiter contract if they disagree, demonstrating
//! genuine inter-contract communication rather than a single monolithic
//! contract. Every state transition emits an event so a frontend can render
//! a live activity feed without polling contract storage directly.

#![no_std]

use arbiter_contract::{ArbiterContractClient, DisputeStatus};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env,
    String, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MilestoneStatus {
    Pending,
    Submitted,
    Approved,
    Released,
    Disputed,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Milestone {
    pub description: String,
    pub amount: i128,
    pub status: MilestoneStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum JobStatus {
    Active,
    Disputed,
    Completed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Job {
    pub client: Address,
    pub freelancer: Address,
    pub token: Address,
    pub milestones: Vec<Milestone>,
    pub status: JobStatus,
    pub funded_amount: i128,
}

#[contracttype]
pub enum DataKey {
    ArbiterContract,
    NextJobId,
    Job(u64),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    JobNotFound = 3,
    InvalidMilestoneIndex = 4,
    Unauthorized = 5,
    InvalidMilestoneStatus = 6,
    NoMilestonesProvided = 7,
    InvalidAmount = 8,
    JobNotActive = 9,
    JobAlreadyDisputed = 10,
    JobNotDisputed = 11,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// One-time setup, pointing this escrow deployment at a shared Arbiter
    /// contract instance.
    pub fn initialize(env: Env, arbiter_contract: Address) -> Result<(), EscrowError> {
        if env.storage().instance().has(&DataKey::ArbiterContract) {
            return Err(EscrowError::AlreadyInitialized);
        }
        env.storage()
            .instance()
            .set(&DataKey::ArbiterContract, &arbiter_contract);
        env.storage().instance().set(&DataKey::NextJobId, &0u64);
        Ok(())
    }

    /// Client creates and funds a new job with a list of (description, amount)
    /// milestones. Funds are transferred from the client into this contract's
    /// balance immediately (a cross-contract call into the token contract).
    pub fn create_job(
        env: Env,
        client: Address,
        freelancer: Address,
        token: Address,
        milestone_descriptions: Vec<String>,
        milestone_amounts: Vec<i128>,
    ) -> Result<u64, EscrowError> {
        client.require_auth();

        if milestone_descriptions.is_empty() || milestone_descriptions.len() != milestone_amounts.len() {
            return Err(EscrowError::NoMilestonesProvided);
        }

        let mut milestones = Vec::new(&env);
        let mut total: i128 = 0;
        for i in 0..milestone_descriptions.len() {
            let amount = milestone_amounts.get(i).unwrap();
            if amount <= 0 {
                return Err(EscrowError::InvalidAmount);
            }
            total += amount;
            milestones.push_back(Milestone {
                description: milestone_descriptions.get(i).unwrap(),
                amount,
                status: MilestoneStatus::Pending,
            });
        }

        // Cross-contract call: pull funds from client into this contract.
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&client, &env.current_contract_address(), &total);

        let job_id: u64 = env.storage().instance().get(&DataKey::NextJobId).unwrap_or(0);
        let job = Job {
            client: client.clone(),
            freelancer: freelancer.clone(),
            token,
            milestones,
            status: JobStatus::Active,
            funded_amount: total,
        };
        env.storage().persistent().set(&DataKey::Job(job_id), &job);
        env.storage()
            .instance()
            .set(&DataKey::NextJobId, &(job_id + 1));

        env.events().publish(
            (symbol_short!("job"), symbol_short!("created"), job_id),
            (client, freelancer, total),
        );

        Ok(job_id)
    }

    /// Freelancer marks a milestone as submitted, ready for client review.
    pub fn submit_milestone(
        env: Env,
        freelancer: Address,
        job_id: u64,
        milestone_index: u32,
    ) -> Result<(), EscrowError> {
        freelancer.require_auth();
        let mut job = Self::load_job(&env, job_id)?;

        if job.status != JobStatus::Active {
            return Err(EscrowError::JobNotActive);
        }
        if job.freelancer != freelancer {
            return Err(EscrowError::Unauthorized);
        }

        let mut milestone = job
            .milestones
            .get(milestone_index)
            .ok_or(EscrowError::InvalidMilestoneIndex)?;
        if milestone.status != MilestoneStatus::Pending {
            return Err(EscrowError::InvalidMilestoneStatus);
        }
        milestone.status = MilestoneStatus::Submitted;
        job.milestones.set(milestone_index, milestone);
        env.storage().persistent().set(&DataKey::Job(job_id), &job);

        env.events().publish(
            (symbol_short!("milestone"), symbol_short!("submit"), job_id),
            milestone_index,
        );
        Ok(())
    }

    /// Client approves a submitted milestone AND releases its funds to the
    /// freelancer in one step (cross-contract call to the token contract).
    pub fn approve_and_release(
        env: Env,
        client: Address,
        job_id: u64,
        milestone_index: u32,
    ) -> Result<(), EscrowError> {
        client.require_auth();
        let mut job = Self::load_job(&env, job_id)?;

        if job.status != JobStatus::Active {
            return Err(EscrowError::JobNotActive);
        }
        if job.client != client {
            return Err(EscrowError::Unauthorized);
        }

        let mut milestone = job
            .milestones
            .get(milestone_index)
            .ok_or(EscrowError::InvalidMilestoneIndex)?;
        if milestone.status != MilestoneStatus::Submitted {
            return Err(EscrowError::InvalidMilestoneStatus);
        }

        milestone.status = MilestoneStatus::Approved;
        job.milestones.set(milestone_index, milestone.clone());
        env.storage().persistent().set(&DataKey::Job(job_id), &job);

        env.events().publish(
            (symbol_short!("milestone"), symbol_short!("approve"), job_id),
            milestone_index,
        );

        // Cross-contract call: release funds from escrow to the freelancer.
        let token_client = token::Client::new(&env, &job.token);
        token_client.transfer(
            &env.current_contract_address(),
            &job.freelancer,
            &milestone.amount,
        );

        let mut job = Self::load_job(&env, job_id)?;
        let mut released = job.milestones.get(milestone_index).unwrap();
        released.status = MilestoneStatus::Released;
        job.milestones.set(milestone_index, released);

        let all_released = job
            .milestones
            .iter()
            .all(|m| m.status == MilestoneStatus::Released);
        if all_released {
            job.status = JobStatus::Completed;
        }
        env.storage().persistent().set(&DataKey::Job(job_id), &job);

        env.events().publish(
            (symbol_short!("milestone"), symbol_short!("released"), job_id),
            (milestone_index, milestone.amount, job.freelancer.clone()),
        );

        if all_released {
            env.events()
                .publish((symbol_short!("job"), symbol_short!("complete")), job_id);
        }

        Ok(())
    }

    /// Either party escalates the job to the Arbiter contract. This is the
    /// core inter-contract call of the project: Escrow invokes Arbiter.
    pub fn raise_dispute(
        env: Env,
        caller: Address,
        job_id: u64,
        reason: String,
    ) -> Result<(), EscrowError> {
        caller.require_auth();
        let mut job = Self::load_job(&env, job_id)?;

        if job.client != caller && job.freelancer != caller {
            return Err(EscrowError::Unauthorized);
        }
        if job.status == JobStatus::Disputed {
            return Err(EscrowError::JobAlreadyDisputed);
        }
        if job.status != JobStatus::Active {
            return Err(EscrowError::JobNotActive);
        }

        let arbiter_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::ArbiterContract)
            .ok_or(EscrowError::NotInitialized)?;

        // Cross-contract call out to the Arbiter contract.
        let arbiter_client = ArbiterContractClient::new(&env, &arbiter_address);
        arbiter_client.arb_raise_dispute(&env.current_contract_address(), &job_id, &caller, &reason);

        job.status = JobStatus::Disputed;
        env.storage().persistent().set(&DataKey::Job(job_id), &job);

        env.events().publish(
            (symbol_short!("job"), symbol_short!("disputed"), job_id),
            caller,
        );
        Ok(())
    }

    /// Anyone can call this after the Arbiter has resolved the dispute; it
    /// reads the outcome back from the Arbiter contract (another
    /// cross-contract call) and settles remaining escrowed funds
    /// accordingly.
    pub fn settle_dispute(env: Env, job_id: u64) -> Result<DisputeStatus, EscrowError> {
        let mut job = Self::load_job(&env, job_id)?;
        if job.status != JobStatus::Disputed {
            return Err(EscrowError::JobNotDisputed);
        }

        let arbiter_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::ArbiterContract)
            .ok_or(EscrowError::NotInitialized)?;
        let arbiter_client = ArbiterContractClient::new(&env, &arbiter_address);
        let dispute = arbiter_client
            .get_dispute(&env.current_contract_address(), &job_id)
            .ok_or(EscrowError::JobNotDisputed)?;

        if dispute.status == DisputeStatus::Open {
            // Still awaiting an arbiter decision; nothing to settle yet.
            return Ok(dispute.status);
        }

        let remaining: i128 = job
            .milestones
            .iter()
            .filter(|m| m.status != MilestoneStatus::Released)
            .map(|m| m.amount)
            .sum();

        let token_client = token::Client::new(&env, &job.token);
        match dispute.status.clone() {
            DisputeStatus::ResolvedForFreelancer => {
                token_client.transfer(&env.current_contract_address(), &job.freelancer, &remaining);
            }
            DisputeStatus::ResolvedForClient => {
                token_client.transfer(&env.current_contract_address(), &job.client, &remaining);
            }
            DisputeStatus::Split => {
                let half = remaining / 2;
                token_client.transfer(&env.current_contract_address(), &job.freelancer, &half);
                token_client.transfer(&env.current_contract_address(), &job.client, &(remaining - half));
            }
            DisputeStatus::None | DisputeStatus::Open => {}
        }

        job.status = JobStatus::Completed;
        env.storage().persistent().set(&DataKey::Job(job_id), &job);

        env.events().publish(
            (symbol_short!("job"), symbol_short!("dresolve"), job_id),
            dispute.status.clone(),
        );
        env.events()
            .publish((symbol_short!("job"), symbol_short!("complete")), job_id);

        Ok(dispute.status)
    }

    pub fn get_job(env: Env, job_id: u64) -> Result<Job, EscrowError> {
        Self::load_job(&env, job_id)
    }

    fn load_job(env: &Env, job_id: u64) -> Result<Job, EscrowError> {
        env.storage()
            .persistent()
            .get(&DataKey::Job(job_id))
            .ok_or(EscrowError::JobNotFound)
    }
}

mod test;
