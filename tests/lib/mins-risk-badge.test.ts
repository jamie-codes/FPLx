import { describe, it, expect } from 'vitest'
import { getMinsRiskConfig } from '@/components/shared/MinsRiskBadge'

describe('getMinsRiskConfig', () => {
  it('returns correct config for nailed', () => {
    const config = getMinsRiskConfig('nailed')
    expect(config).not.toBeNull()
    expect(config!.label).toBe('Nailed')
    expect(config!.bg).toBe('bg-green-100')
    expect(config!.text).toBe('text-green-800')
    expect(config!.title).toBe('Nailed: high start probability (\u226585%)')
  })

  it('returns correct config for likely_start', () => {
    const config = getMinsRiskConfig('likely_start')
    expect(config).not.toBeNull()
    expect(config!.label).toBe('Likely start')
    expect(config!.bg).toBe('bg-blue-100')
    expect(config!.text).toBe('text-blue-800')
    expect(config!.title).toBe('Likely start: moderate start probability (65\u201384%)')
  })

  it('returns correct config for rotation_risk', () => {
    const config = getMinsRiskConfig('rotation_risk')
    expect(config).not.toBeNull()
    expect(config!.label).toBe('Rotation risk')
    expect(config!.bg).toBe('bg-amber-100')
    expect(config!.text).toBe('text-amber-800')
    expect(config!.title).toBe('Rotation risk: rotation risk identified')
  })

  it('returns correct config for cameo', () => {
    const config = getMinsRiskConfig('cameo')
    expect(config).not.toBeNull()
    expect(config!.label).toBe('Cameo')
    expect(config!.bg).toBe('bg-zinc-100')
    expect(config!.text).toBe('text-zinc-600')
    expect(config!.title).toBe('Cameo: low minutes expected')
  })

  it('returns null for injured', () => {
    const config = getMinsRiskConfig('injured')
    expect(config).toBeNull()
  })

  it('returns null for undefined (cast to any)', () => {
    const config = getMinsRiskConfig(undefined as any)
    expect(config).toBeNull()
  })

  it('returns null for null (cast to any)', () => {
    const config = getMinsRiskConfig(null as any)
    expect(config).toBeNull()
  })
})
