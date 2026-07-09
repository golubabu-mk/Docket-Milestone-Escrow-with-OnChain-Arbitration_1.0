import {
  invokeContract,
  readContract,
  addressToScVal,
  stringToScVal,
  i128ToScVal,
  u32ToScVal,
  u64ToScVal,
  vecToScVal,
} from './sorobanClient'
import { ESCROW_CONTRACT_ID, TOKEN_CONTRACT_ID } from './config'

export async function getNativeBalance(address) {
  const args = [addressToScVal(address)]
  return readContract({
    contractId: TOKEN_CONTRACT_ID,
    method: 'balance',
    args,
  })
}

export async function createJob({ client, freelancer, token, descriptions, amounts }) {
  const args = [
    addressToScVal(client),
    addressToScVal(freelancer),
    addressToScVal(token),
    vecToScVal(descriptions.map((d) => stringToScVal(d))),
    vecToScVal(amounts.map((a) => i128ToScVal(a))),
  ]
  return invokeContract({
    contractId: ESCROW_CONTRACT_ID,
    method: 'create_job',
    args,
    sourcePublicKey: client,
  })
}

export async function submitMilestone({ freelancer, jobId, milestoneIndex }) {
  const args = [addressToScVal(freelancer), u64ToScVal(jobId), u32ToScVal(milestoneIndex)]
  return invokeContract({
    contractId: ESCROW_CONTRACT_ID,
    method: 'submit_milestone',
    args,
    sourcePublicKey: freelancer,
  })
}

export async function approveAndRelease({ client, jobId, milestoneIndex }) {
  const args = [addressToScVal(client), u64ToScVal(jobId), u32ToScVal(milestoneIndex)]
  return invokeContract({
    contractId: ESCROW_CONTRACT_ID,
    method: 'approve_and_release',
    args,
    sourcePublicKey: client,
  })
}

export async function raiseDispute({ caller, jobId, reason }) {
  const args = [addressToScVal(caller), u64ToScVal(jobId), stringToScVal(reason)]
  return invokeContract({
    contractId: ESCROW_CONTRACT_ID,
    method: 'raise_dispute',
    args,
    sourcePublicKey: caller,
  })
}

export async function settleDispute({ caller, jobId }) {
  const args = [u64ToScVal(jobId)]
  return invokeContract({
    contractId: ESCROW_CONTRACT_ID,
    method: 'settle_dispute',
    args,
    sourcePublicKey: caller,
  })
}

export async function getJob({ jobId }) {
  const args = [u64ToScVal(jobId)]
  return readContract({
    contractId: ESCROW_CONTRACT_ID,
    method: 'get_job',
    args,
  })
}

// Normalizes the raw contract Job struct (with Rust-flavored enum/status
// shapes) into the plain shape the UI components expect.
export function normalizeJob(jobId, raw) {
  if (!raw) return null

  const parseStatus = (status) => {
    if (typeof status === 'string') return status
    if (Array.isArray(status)) return status[0]
    return Object.keys(status)[0]
  }

  return {
    id: jobId,
    client: raw.client,
    freelancer: raw.freelancer,
    token: raw.token,
    status: parseStatus(raw.status),
    fundedAmount: raw.funded_amount?.toString?.() ?? String(raw.funded_amount),
    milestones: (raw.milestones || []).map((m) => ({
      description: m.description,
      amount: m.amount?.toString?.() ?? String(m.amount),
      status: parseStatus(m.status),
    })),
  }
}
