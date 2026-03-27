import { describe, it, expect } from 'vitest'
import { parseFPLBootstrap, FPLElementSchema, FPLBootstrapSchema } from '@/lib/fpl-adapter'
import sampleFixture from '../fixtures/bootstrap-static-sample.json'

// Deep-clone helper so we can mutate without affecting other tests
function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

describe('FPLBootstrapSchema', () => {
  it('parses valid bootstrap-static sample without errors', () => {
    const result = parseFPLBootstrap(sampleFixture)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.elements).toHaveLength(3)
    expect(result.data.teams).toHaveLength(2)
    expect(result.data.events).toHaveLength(1)
  })

  it('strips unknown fields not in schema (extra_field_that_should_be_stripped)', () => {
    const result = parseFPLBootstrap(sampleFixture)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect('extra_field_that_should_be_stripped' in result.data.elements[0]).toBe(false)
  })

  it('rejects bootstrap with missing required field (id)', () => {
    const mutated = clone(sampleFixture)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (mutated.elements[0] as any).id
    const result = parseFPLBootstrap(mutated)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(JSON.stringify(result.error)).toContain('id')
  })

  it('rejects bootstrap with wrong type (web_name as number)', () => {
    const mutated = clone(sampleFixture)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(mutated.elements[0] as any).web_name = 123
    const result = parseFPLBootstrap(mutated)
    expect(result.success).toBe(false)
  })
})

describe('FPLElement field validation', () => {
  it('validates defensive_contributions as nullable number (PPS-01)', () => {
    const result = parseFPLBootstrap(sampleFixture)
    expect(result.success).toBe(true)
    if (!result.success) return
    // Magalhaes (index 0): defensive_contributions === 42
    expect(result.data.elements[0].defensive_contributions).toBe(42)
    // Wissa (index 2): defensive_contributions === null
    expect(result.data.elements[2].defensive_contributions).toBeNull()
  })

  it('validates set piece order fields as nullable number (PPS-01)', () => {
    const result = parseFPLBootstrap(sampleFixture)
    expect(result.success).toBe(true)
    if (!result.success) return
    // Saka (index 1): direct_freekicks_order === 1, penalties_order === null, corners === 1
    expect(result.data.elements[1].direct_freekicks_order).toBe(1)
    expect(result.data.elements[1].penalties_order).toBeNull()
    expect(result.data.elements[1].corners_and_indirect_freekicks_order).toBe(1)
    // Magalhaes (index 0): all three set piece fields null
    expect(result.data.elements[0].direct_freekicks_order).toBeNull()
    expect(result.data.elements[0].penalties_order).toBeNull()
    expect(result.data.elements[0].corners_and_indirect_freekicks_order).toBeNull()
    // Wissa (index 2): penalties_order === 1, others null
    expect(result.data.elements[2].penalties_order).toBe(1)
    expect(result.data.elements[2].direct_freekicks_order).toBeNull()
    expect(result.data.elements[2].corners_and_indirect_freekicks_order).toBeNull()
  })

  it('validates minutes and starts as integers (PPS-02)', () => {
    const result = parseFPLBootstrap(sampleFixture)
    expect(result.success).toBe(true)
    if (!result.success) return
    // Magalhaes: minutes=1620, starts=18
    expect(typeof result.data.elements[0].minutes).toBe('number')
    expect(result.data.elements[0].minutes).toBe(1620)
    expect(typeof result.data.elements[0].starts).toBe('number')
    expect(result.data.elements[0].starts).toBe(18)
  })

  it('validates status field accepts all valid codes: a, d, i, s, u, n (PPS-04)', () => {
    const statuses = ['a', 'd', 'i', 's', 'u', 'n'] as const
    // Build a minimal valid element for each status
    const baseElement = {
      id: 1,
      web_name: 'Test',
      team: 1,
      element_type: 2,
      now_cost: 50,
      selected_by_percent: '5.0',
      form: '3.0',
      minutes: 900,
      starts: 10,
      defensive_contributions: null,
      clearances_blocks_interceptions: null,
      direct_freekicks_order: null,
      penalties_order: null,
      corners_and_indirect_freekicks_order: null,
      news: '',
    }
    for (const status of statuses) {
      const result = FPLElementSchema.safeParse({ ...baseElement, status })
      expect(result.success, `status "${status}" should be valid`).toBe(true)
    }
  })

  it('validates news field as string (PPS-04)', () => {
    const result = parseFPLBootstrap(sampleFixture)
    expect(result.success).toBe(true)
    if (!result.success) return
    // Empty string
    expect(result.data.elements[0].news).toBe('')
    // Non-empty string
    expect(result.data.elements[2].news).toBe('Knee injury - 50% chance of playing')
  })
})

describe('parseFPLBootstrap', () => {
  it('returns success:true with typed data for valid input', () => {
    const result = parseFPLBootstrap(sampleFixture)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toBeDefined()
    expect(Array.isArray(result.data.elements)).toBe(true)
  })

  it('returns success:false with error for invalid input', () => {
    const result = parseFPLBootstrap({ elements: 'not-an-array', teams: [], events: [] })
    expect(result.success).toBe(false)
  })
})

// Placeholder: confirms vitest runs
describe('test framework', () => {
  it('vitest runs successfully', () => {
    expect(true).toBe(true)
  })
})
