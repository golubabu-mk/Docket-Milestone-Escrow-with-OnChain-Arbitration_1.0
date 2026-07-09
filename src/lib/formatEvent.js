// Turns a decoded contract event's topics into a short, human-readable
// label + description for the activity feed. Kept as a pure function (no
// SDK calls, no side effects) so it's trivial to unit test.

const TOPIC_LABELS = {
  'job,created': { label: 'Job Created', tone: 'neutral' },
  'milestone,submit': { label: 'Milestone Submitted', tone: 'hold' },
  'milestone,approve': { label: 'Milestone Approved', tone: 'go' },
  'milestone,released': { label: 'Funds Released', tone: 'go' },
  'job,disputed': { label: 'Dispute Raised', tone: 'stop' },
  'job,dresolve': { label: 'Dispute Resolved', tone: 'hold' },
  'job,complete': { label: 'Job Completed', tone: 'go' },
  'dispute,raised': { label: 'Dispute Filed with Arbiter', tone: 'stop' },
  'dispute,resolved': { label: 'Arbiter Ruling Issued', tone: 'hold' },
  'arbiter,added': { label: 'Arbiter Added to Panel', tone: 'neutral' },
}

export function formatEvent(event) {
  if (!event || !Array.isArray(event.topics)) {
    return { label: 'Unknown Event', tone: 'neutral', detail: '' }
  }

  const symbolTopics = event.topics.filter((t) => typeof t === 'string')
  const key = symbolTopics.slice(0, 2).join(',')
  const meta = TOPIC_LABELS[key] || { label: symbolTopics.join(' / ') || 'Event', tone: 'neutral' }

  return {
    id: event.id,
    label: meta.label,
    tone: meta.tone,
    ledger: event.ledger,
    txHash: event.txHash,
    timestamp: event.timestamp,
    raw: event,
  }
}

export function formatEvents(events) {
  return events.map(formatEvent)
}
