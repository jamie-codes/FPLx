// @vitest-environment jsdom
// Phase 58 ML-03/04/05/06/07 — RivalDetailPanel unit tests.
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RivalDetailPanel } from './RivalDetailPanel'
import type { MergedPlayer, PositionCode, RivalEntry, RivalPick, TransferSuggestion } from '@/lib/types'

function mp(id: number, web_name: string, element_type: PositionCode, xPts_1gw?: number, xPts_90th_1gw?: number): MergedPlayer {
  return {
    id, web_name, team: 1, team_short_name: 'XXX', element_type, now_cost: 50,
    selected_by_percent: '0', form: '0', status: 'a', minutes: 90, starts: 1, total_points: 0,
    goals_scored: 0, assists: 0, expected_goals: 0, expected_assists: 0,
    pts_last3gw: 0, pts_last5gw: 0, pts_gw_count: 0,
    defensive_contribution: null, clearances_blocks_interceptions: null,
    direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null,
    penalties_text: '', direct_freekicks_text: '', corners_and_indirect_freekicks_text: '',
    news: '', cost_change_event: 0, cost_change_start: 0,
    understat_id: null, xg_per90: null, xa_per90: null,
    minutes_per90: 0, form_pts_per90: 0, fixtures: [],
    xmins: 0, start_prob: 0, mins_risk: 'nailed',
    xPts_1gw, xPts_90th_1gw,
  } as MergedPlayer
}

function pick(element: number, is_captain = false): RivalPick {
  return { element, position: 1, multiplier: is_captain ? 2 : 1, is_captain, is_vice_captain: false }
}

function rivalEntry(over: Partial<RivalEntry>): RivalEntry {
  return {
    entryId: 1, entryName: 'A Team', playerName: 'Alice',
    rank: 5, rankGap: -3, picks: [], captainPlayerId: null, chipsRemaining: [],
    ...over,
  }
}

const medians = new Map<PositionCode, number>([[1, 0], [2, 0], [3, 5], [4, 0]])

describe('RivalDetailPanel', () => {
  it('renders placeholder when rival is null', () => {
    const { container } = render(
      <RivalDetailPanel
        rival={null}
        userPickIds={new Set()}
        playerById={new Map()}
        posMedians={medians}
        userCaptainCandidate={null}
        transferSuggestions={[]}
      />,
    )
    expect(container.textContent).toContain('Select a rival from the table to see differential analysis.')
  })

  it('renders 5 section headings in spec order', () => {
    const r = rivalEntry({})
    const { container } = render(
      <RivalDetailPanel
        rival={r}
        userPickIds={new Set()}
        playerById={new Map()}
        posMedians={medians}
        userCaptainCandidate={null}
        transferSuggestions={[]}
      />,
    )
    const headings = Array.from(container.querySelectorAll('h3')).map(h => h.textContent)
    expect(headings).toEqual([
      'Captain Edge', 'Shared with Alice', 'Your Advantage', 'Rival Threats', 'Blocking Transfers',
    ])
  })

  it('ML-07 pre-deadline: Captain Edge shows em-dash with tooltip', () => {
    const r = rivalEntry({ captainPlayerId: null })
    const { container } = render(
      <RivalDetailPanel
        rival={r}
        userPickIds={new Set()}
        playerById={new Map()}
        posMedians={medians}
        userCaptainCandidate={mp(99, 'Foden', 3, 7, 9)}
        transferSuggestions={[]}
      />,
    )
    const captainSection = container.querySelector('section')!
    expect(captainSection.textContent).toContain('—')
    const titled = captainSection.querySelector('[title]')
    expect(titled?.getAttribute('title')).toContain('after the GW deadline')
  })

  it('ML-07 post-deadline positive edge: shows +X.X format', () => {
    const r = rivalEntry({ captainPlayerId: 2 })
    const userCaptain = mp(1, 'Salah', 3, 8, 10.5)
    const rivalCaptain = mp(2, 'Foden', 3, 7, 8.0)
    const playerById = new Map([[1, userCaptain], [2, rivalCaptain]])
    const { container } = render(
      <RivalDetailPanel
        rival={r}
        userPickIds={new Set([1])}
        playerById={playerById}
        posMedians={medians}
        userCaptainCandidate={userCaptain}
        transferSuggestions={[]}
      />,
    )
    const captainSection = container.querySelector('section')!
    expect(captainSection.textContent).toContain('+2.5 xPts vs Alice')
  })

  it('ML-07 post-deadline negative edge: shows Unicode minus −X.X', () => {
    const r = rivalEntry({ captainPlayerId: 2 })
    const userCaptain = mp(1, 'Salah', 3, 6, 7.0)
    const rivalCaptain = mp(2, 'Foden', 3, 8, 9.5)
    const playerById = new Map([[1, userCaptain], [2, rivalCaptain]])
    const { container } = render(
      <RivalDetailPanel
        rival={r}
        userPickIds={new Set([1])}
        playerById={playerById}
        posMedians={medians}
        userCaptainCandidate={userCaptain}
        transferSuggestions={[]}
      />,
    )
    const captainSection = container.querySelector('section')!
    expect(captainSection.textContent).toContain('−2.5 xPts vs Alice')
  })

  it('ML-03: shared section lists players owned by both', () => {
    const r = rivalEntry({ picks: [pick(2), pick(3), pick(4)] })
    const playerById = new Map<number, MergedPlayer>([
      [1, mp(1, 'P1', 3, 7)], [2, mp(2, 'P2', 3, 7)], [3, mp(3, 'P3', 3, 7)], [4, mp(4, 'P4', 3, 7)],
    ])
    const { container } = render(
      <RivalDetailPanel
        rival={r}
        userPickIds={new Set([1, 2, 3])}
        playerById={playerById}
        posMedians={medians}
        userCaptainCandidate={null}
        transferSuggestions={[]}
      />,
    )
    const sharedSection = container.querySelectorAll('section')[1]
    expect(sharedSection.textContent).toContain('P2')
    expect(sharedSection.textContent).toContain('P3')
    expect(sharedSection.textContent).not.toContain('P1')
    expect(sharedSection.textContent).not.toContain('P4')
  })

  it('ML-04: your-advantage section lists user-only players', () => {
    const r = rivalEntry({ picks: [pick(2), pick(3)] })
    const playerById = new Map<number, MergedPlayer>([
      [1, mp(1, 'P1', 3, 7)], [2, mp(2, 'P2', 3, 7)], [3, mp(3, 'P3', 3, 7)],
    ])
    const { container } = render(
      <RivalDetailPanel
        rival={r}
        userPickIds={new Set([1, 2, 3])}
        playerById={playerById}
        posMedians={medians}
        userCaptainCandidate={null}
        transferSuggestions={[]}
      />,
    )
    const advSection = container.querySelectorAll('section')[2]
    expect(advSection.textContent).toContain('P1')
    expect(advSection.textContent).not.toContain('P2')
  })

  it('ML-05: rival-threats lists rival-only above-median players', () => {
    const r = rivalEntry({ picks: [pick(4)] })
    const playerById = new Map<number, MergedPlayer>([
      [4, mp(4, 'Threat', 3, 8)],  // xPts 8 > median 5
    ])
    const { container } = render(
      <RivalDetailPanel
        rival={r}
        userPickIds={new Set()}
        playerById={playerById}
        posMedians={medians}
        userCaptainCandidate={null}
        transferSuggestions={[]}
      />,
    )
    const threatSection = container.querySelectorAll('section')[3]
    expect(threatSection.textContent).toContain('Threat')
  })

  it('ML-05 empty: shows "[Rival Name] has no high-xPts threats this GW."', () => {
    const r = rivalEntry({ picks: [] })
    const { container } = render(
      <RivalDetailPanel
        rival={r}
        userPickIds={new Set()}
        playerById={new Map()}
        posMedians={medians}
        userCaptainCandidate={null}
        transferSuggestions={[]}
      />,
    )
    const threatSection = container.querySelectorAll('section')[3]
    expect(threatSection.textContent).toContain('Alice has no high-xPts threats this GW.')
  })

  it('ML-06: blocking-transfers lists qualifying buy players', () => {
    const r = rivalEntry({ picks: [pick(50)] })  // rival owns 50
    const buy = mp(99, 'BlockTarget', 3, 8)       // not rival-owned, above median
    const sell = mp(1, 'Sell', 3, 1)
    const sug: TransferSuggestion = {
      kind: 'single', sell, buy, cost: 0, xPtsGain: 7, xPtsGainPerGw: 7, breakEvenGws: null,
    }
    const playerById = new Map<number, MergedPlayer>([[99, buy], [1, sell], [50, mp(50, 'P50', 3, 4)]])
    const { container } = render(
      <RivalDetailPanel
        rival={r}
        userPickIds={new Set([1])}
        playerById={playerById}
        posMedians={medians}
        userCaptainCandidate={null}
        transferSuggestions={[sug]}
      />,
    )
    const blockSection = container.querySelectorAll('section')[4]
    expect(blockSection.textContent).toContain('BlockTarget')
  })

  it('ML-06 empty: shows "No blocking transfer opportunities identified."', () => {
    const r = rivalEntry({})
    const { container } = render(
      <RivalDetailPanel
        rival={r}
        userPickIds={new Set()}
        playerById={new Map()}
        posMedians={medians}
        userCaptainCandidate={null}
        transferSuggestions={[]}
      />,
    )
    const blockSection = container.querySelectorAll('section')[4]
    expect(blockSection.textContent).toContain('No blocking transfer opportunities identified.')
  })
})
