import { describe, it, expect } from 'vitest'
import { passesGuardrail, findHallucinatedNames } from './prose-guardrail'

const CORPUS = ['Salah', 'Haaland', 'Saka', 'Madueke', 'Mbeumo', 'Watkins', 'Palmer']

describe('passesGuardrail', () => {
  it('passes when only allowed names appear', () => {
    expect(passesGuardrail('Salah and Haaland are top picks.', ['Salah', 'Haaland'], CORPUS)).toBe(true)
  })

  it('rejects unknown names from corpus not in allowed set', () => {
    expect(passesGuardrail('Salah leads, but Palmer is the dark horse.', ['Salah'], CORPUS)).toBe(false)
  })

  it('is case-insensitive and whitespace-tolerant', () => {
    expect(passesGuardrail('Mo  SALAH leads.', ['mo salah'], ['Mo Salah'])).toBe(true)
  })

  it('ignores corpus names absent from prose (no false positive)', () => {
    expect(passesGuardrail('A solid week ahead.', [], CORPUS)).toBe(true)
  })

  it('treats empty allowed set as failure if any corpus name appears', () => {
    expect(passesGuardrail('Saka shines.', [], CORPUS)).toBe(false)
  })

  it('treats empty prose as passing (no hallucinations possible)', () => {
    expect(passesGuardrail('', ['Salah'], CORPUS)).toBe(true)
  })
})

describe('findHallucinatedNames', () => {
  it('returns offending names (normalised) for assertion', () => {
    const names = findHallucinatedNames('Salah and Palmer are picks.', ['Salah'], CORPUS)
    expect(names).toContain('palmer')
    expect(names).not.toContain('salah')
  })
})
