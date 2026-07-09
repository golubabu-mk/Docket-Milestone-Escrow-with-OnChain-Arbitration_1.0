import { rpc, scValToNative } from '@stellar/stellar-sdk'
import { RPC_URL, ESCROW_CONTRACT_ID, ARBITER_CONTRACT_ID } from './config'

const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') })

// Soroban's getEvents RPC call only looks back a limited ledger window, so we
// track the last-seen ledger in memory and only ask for what's new each poll
// — this is what makes the "live feed" real-time rather than a full re-fetch.
let lastLedger = null

function decodeEvent(raw) {
  const topics = raw.topic.map((t) => {
    try {
      return scValToNative(t)
    } catch {
      return null
    }
  })
  let value = null
  try {
    value = scValToNative(raw.value)
  } catch {
    value = null
  }
  return {
    id: raw.id,
    ledger: raw.ledger,
    contractId: raw.contractId,
    topics,
    value,
    txHash: raw.txHash,
    timestamp: raw.ledgerClosedAt,
  }
}

/**
 * Fetches events emitted since the last poll for both the escrow and arbiter
 * contracts. Call this on an interval (see useEventStream hook) to drive a
 * live activity feed without the user refreshing the page.
 */
export async function fetchNewEvents() {
  const latestLedger = await server.getLatestLedger()
  const currentLedger = latestLedger.sequence

  if (lastLedger === null) {
    // First poll: look back a small, bounded window so we don't flood the
    // feed with the entire contract history on initial load.
    lastLedger = Math.max(currentLedger - 100, 1)
  }

  if (lastLedger >= currentLedger) {
    return []
  }

  const contractIds = [ESCROW_CONTRACT_ID, ARBITER_CONTRACT_ID].filter(Boolean)
  if (contractIds.length === 0) return []

  const response = await server.getEvents({
    startLedger: lastLedger + 1,
    filters: [
      {
        type: 'contract',
        contractIds,
      },
    ],
    limit: 100,
  })

  lastLedger = currentLedger
  return (response.events || []).map(decodeEvent)
}

export function resetEventCursor() {
  lastLedger = null
}
