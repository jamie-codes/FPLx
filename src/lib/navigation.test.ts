// UIX-01 Task 4: navigation completeness — the keep-all-features tripwire.
// The 27 legacy SubTab ids are hardcoded from the feature inventory
// (docs/superpowers/specs/2026-06-12-uix01-feature-inventory.md); if any tool
// is dropped from GROUPS this fails before the UI can lose a feature.
import { describe, it, expect } from 'vitest'
import { GROUPS, ALL_TOOL_IDS, groupOf } from './navigation'

// 'decision' was folded into 'cockpit' (product-audit 2026-07, owner-approved):
// DecisionSummaryTab renders inside CockpitTab and ?t=decision aliases to it,
// so the FEATURE survives — only the standalone nav entry retired.
const LEGACY_27 = [
  'gems', 'picks', 'insights', 'defcon', 'set-pieces', 'planner', 'manual-plan',
  'route-tree', 'club-form', 'value-gems', 'accuracy', 'season', 'window',
  'transfers', 'optimiser', 'price-reset', 'price-changes',
  'rivals', 'lineup', 'review', 'rank-sim', 'next-season', 'watchlist',
  'perfect-gw', 'live', 'wildcard',
] as const

describe('navigation.ts completeness (UIX-01)', () => {
  it('has exactly 29 tool ids (26 legacy + home + transfers-confirmed + cockpit) with no duplicates', () => {
    expect(ALL_TOOL_IDS).toHaveLength(29)
    expect(new Set(ALL_TOOL_IDS).size).toBe(29)
  })

  it('contains every surviving legacy SubTab id exactly once', () => {
    for (const id of LEGACY_27) {
      expect(ALL_TOOL_IDS.filter((t) => t === id), `legacy id ${id}`).toHaveLength(1)
    }
  })

  it('includes the new home id', () => {
    expect(ALL_TOOL_IDS).toContain('home')
  })

  it('includes cockpit at the top of This Week (product-audit 2026-07)', () => {
    expect(ALL_TOOL_IDS).toContain('cockpit')
    const thisWeek = GROUPS.find((g) => g.id === 'this-week')!
    expect(thisWeek.tools[0].id).toBe('cockpit')
  })

  it('exposes the 6 groups in sidebar order', () => {
    expect(GROUPS.map((g) => g.id)).toEqual([
      'home', 'this-week', 'my-squad', 'research', 'planning', 'model',
    ])
  })

  it('every group icon is a lucide component reference, not an emoji string', () => {
    for (const group of GROUPS) {
      // lucide-react icons are forwardRef exotic components (objects with render)
      expect(typeof group.icon, `${group.id} icon`).not.toBe('string')
      expect(group.icon, `${group.id} icon`).toBeTruthy()
      expect(['function', 'object']).toContain(typeof group.icon)
    }
  })

  it('every tool has a label and a mobileLabel', () => {
    for (const group of GROUPS) {
      for (const tool of group.tools) {
        expect(tool.label.length, `${tool.id} label`).toBeGreaterThan(0)
        expect(tool.mobileLabel.length, `${tool.id} mobileLabel`).toBeGreaterThan(0)
      }
    }
  })

  it('groupOf resolves a tool to its group', () => {
    expect(groupOf('gems').id).toBe('research')
    expect(groupOf('home').id).toBe('home')
    expect(groupOf('rank-sim').id).toBe('my-squad')
    expect(groupOf('season').id).toBe('model')
  })
})
