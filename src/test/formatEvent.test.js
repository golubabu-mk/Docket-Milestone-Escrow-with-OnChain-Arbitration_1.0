import { describe, it, expect } from 'vitest'
import { formatEvent, formatEvents } from '../lib/formatEvent'

describe('formatEvent', () => {
  it('labels a job created event correctly', () => {
    const event = {
      id: '1',
      topics: ['job', 'created', 12345],
      ledger: 100,
      txHash: 'abc123',
      timestamp: '2026-07-08T00:00:00Z',
    }
    const result = formatEvent(event)
    expect(result.label).toBe('Job Created')
    expect(result.tone).toBe('neutral')
  })

  it('labels a milestone submitted event with hold tone', () => {
    const event = { id: '2', topics: ['milestone', 'submit', 42], ledger: 101 }
    const result = formatEvent(event)
    expect(result.label).toBe('Milestone Submitted')
    expect(result.tone).toBe('hold')
  })

  it('labels a dispute raised event with stop tone', () => {
    const event = { id: '3', topics: ['job', 'disputed', 7], ledger: 102 }
    const result = formatEvent(event)
    expect(result.label).toBe('Dispute Raised')
    expect(result.tone).toBe('stop')
  })

  it('labels a funds released event with go tone', () => {
    const event = { id: '4', topics: ['milestone', 'released', 1], ledger: 103 }
    const result = formatEvent(event)
    expect(result.label).toBe('Funds Released')
    expect(result.tone).toBe('go')
  })

  it('falls back gracefully for unrecognized topics', () => {
    const event = { id: '5', topics: ['mystery', 'thing'], ledger: 104 }
    const result = formatEvent(event)
    expect(result.label).toBe('mystery / thing')
    expect(result.tone).toBe('neutral')
  })

  it('handles malformed or missing event input without throwing', () => {
    expect(formatEvent(null).label).toBe('Unknown Event')
    expect(formatEvent({}).label).toBe('Unknown Event')
    expect(formatEvent({ topics: null }).label).toBe('Unknown Event')
  })

  it('preserves ledger, txHash, and timestamp metadata', () => {
    const event = {
      id: '6',
      topics: ['job', 'complete', 3],
      ledger: 200,
      txHash: 'deadbeef',
      timestamp: '2026-07-08T12:00:00Z',
    }
    const result = formatEvent(event)
    expect(result.ledger).toBe(200)
    expect(result.txHash).toBe('deadbeef')
    expect(result.timestamp).toBe('2026-07-08T12:00:00Z')
  })
})

describe('formatEvents', () => {
  it('maps an array of raw events to formatted entries in order', () => {
    const events = [
      { id: '1', topics: ['job', 'created'], ledger: 1 },
      { id: '2', topics: ['job', 'disputed'], ledger: 2 },
    ]
    const results = formatEvents(events)
    expect(results).toHaveLength(2)
    expect(results[0].label).toBe('Job Created')
    expect(results[1].label).toBe('Dispute Raised')
  })

  it('returns an empty array when given no events', () => {
    expect(formatEvents([])).toEqual([])
  })
})
