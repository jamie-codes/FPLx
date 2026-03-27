import { describe, it, expect } from 'vitest'

// These tests will import from '@/lib/fpl-adapter' once Plan 02 creates it.
// For now, stubs confirm the test framework runs.

describe('FPLBootstrapSchema', () => {
  it.todo('parses valid bootstrap-static sample without errors')
  it.todo('strips unknown fields not in schema')
  it.todo('rejects bootstrap with missing required field (id)')
  it.todo('rejects bootstrap with wrong type (web_name as number)')
})

describe('FPLElement field validation', () => {
  it.todo('validates defensive_contributions as nullable number (PPS-01)')
  it.todo('validates set piece order fields as nullable number (PPS-01)')
  it.todo('validates minutes and starts as integers (PPS-02)')
  it.todo('validates status field accepts all valid codes: a, d, i, s, u, n (PPS-04)')
  it.todo('validates news field as string (PPS-04)')
})

describe('parseFPLBootstrap', () => {
  it.todo('returns success:true with typed data for valid input')
  it.todo('returns success:false with error for invalid input')
})

// Placeholder: confirms vitest runs
describe('test framework', () => {
  it('vitest runs successfully', () => {
    expect(true).toBe(true)
  })
})
