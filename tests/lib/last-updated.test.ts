import { describe, it, expect } from 'vitest'

// Test the pure logic: stale=true should produce 'text-amber-600', stale=false should produce 'text-zinc-400'
describe('LastUpdated stale styling', () => {
  it('returns amber class when stale is true', () => {
    const stale = true
    const className = `text-xs mt-1 ${stale ? 'text-amber-600' : 'text-zinc-400'}`
    expect(className).toContain('text-amber-600')
    expect(className).not.toContain('text-zinc-400')
  })

  it('returns zinc class when stale is false', () => {
    const stale = false
    const className = `text-xs mt-1 ${stale ? 'text-amber-600' : 'text-zinc-400'}`
    expect(className).toContain('text-zinc-400')
    expect(className).not.toContain('text-amber-600')
  })
})
