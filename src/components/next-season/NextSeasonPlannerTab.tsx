'use client'

// Phase 126 (NSP-04, NSP-03): NextSeasonPlannerTab — read-only pre-season squad display
// + GW1-8 FDR heatmap section.
// Phase 127 (127-04): Updated to consume PreSeasonSquadResponse envelope (D-08).
//   Added solver badge (ILP/Greedy pill) and health indicator paragraph (GREEDY-03).
// Phase 128 (128-04): Added usePreSeasonActive hook integration — status pill (Awaiting/Live)
//   and first-activation banner with localStorage suppression (AUTO-03).
// Phase 129 (COST-01, COST-02): budget slider + useDeferredValue commit pipeline; consumes inputs envelope from /api/pre-season-squad?include=inputs.
// Phase 129 Wave 3 (COST-03): infeasibility <p> with D-08/D-09 copy, dynamic warning-tier gradient (D-10), muted-only track when health null (D-11), inputs-refetch reset effect (R6).
// UIX-04 (batch-table gap fix): retokenized — raw palette → semantic tokens; pill/banner/track
// semantics per spec ruling 3 (budget validity → warning, solver/live state → positive).
// D-04: read-only (no mutation paths, no <button> elements that change squad state).
// D-05: formation grid (GK/DEF/MID/FWD rows + 4 bench).
// D-06: ppm as native title-attribute tooltip on total-points span only (not visible column).
import { Fragment, useState, useDeferredValue, useMemo, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { usePreSeasonSquad } from '@/lib/hooks/usePreSeasonSquad'
import { usePreSeasonActive } from '@/lib/hooks/usePreSeasonActive'
// HeatMapRow imported but fixture data is deferred (GW1-8-FIXTURES deferred item in CONTEXT.md).
// The populated code path is future-ready; the empty-state path is the expected render at ship time.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { HeatMapRow } from '@/components/club-form/FixtureHeatMap'
import { buildPreSeasonSquad } from '@/lib/pre-season-squad'
import { buildPreSeasonArchetypes } from '@/lib/pre-season-archetypes'
import type { PreSeasonPlayer, PreSeasonSquad, SquadHealth } from '@/lib/types'
import type { ArchetypeSquad } from '@/lib/pre-season-archetypes'

const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const POSITION_ORDER = [1, 2, 3, 4]

function FormationGrid({ squad, solver }: { squad: PreSeasonSquad; solver?: 'ilp' | 'greedy' | null }) {
  const startersByPosition: Record<number, PreSeasonPlayer[]> = { 1: [], 2: [], 3: [], 4: [] }
  for (const p of squad.starters) {
    startersByPosition[p.element_type]?.push(p)
  }

  return (
    <>
      {/* Headline row: formation + budget + solver badge */}
      <div className="text-sm text-ink py-2 flex flex-wrap items-center gap-2">
        <span><span className="font-semibold">Formation:</span> {squad.formation}</span>
        <span className="text-ink-muted">│</span>
        <span><span className="font-semibold">Budget used:</span> £{(squad.budgetUsed / 10).toFixed(1)}m</span>
        {solver === 'ilp' && (
          <span className="text-xs font-normal bg-positive-soft text-positive rounded px-2 py-1">
            ILP
          </span>
        )}
        {solver === 'greedy' && (
          <span className="text-xs font-normal bg-surface-2 text-ink-muted rounded px-2 py-1">
            Greedy
          </span>
        )}
      </div>

      {/* Position-grouped XI rows */}
      {POSITION_ORDER.map(pos => {
        const group = startersByPosition[pos] ?? []
        if (group.length === 0) return null
        return (
          <Fragment key={pos}>
            <div className="text-[10px] font-semibold uppercase text-ink-muted pt-2 pb-0.5 bg-surface-2 px-1">
              {POSITION_LABELS[pos]}
            </div>
            {group.map(p => (
              <div
                key={p.id}
                className="flex items-center justify-between py-1.5 border-b border-line border-l-2 border-l-positive pl-2 text-sm"
              >
                <span className="font-semibold text-ink">{p.web_name}</span>
                <span className="text-xs text-ink-muted">
                  <span>{p.team_short_name}</span>
                  <span className="ml-2">£{(p.now_cost / 10).toFixed(1)}m</span>
                  <span className="ml-2" title={`${p.ppm.toFixed(2)}pts/min (last season)`}>{p.total_points}pts</span>
                </span>
              </div>
            ))}
          </Fragment>
        )
      })}

      {/* Bench section */}
      <div className="text-[10px] font-semibold uppercase text-ink-muted pt-2 pb-0.5 bg-surface-2 px-1">
        Bench
      </div>
      {squad.bench.map(p => (
        <div
          key={p.id}
          className="flex items-center justify-between py-1.5 border-b border-line opacity-60 pl-2 text-sm"
        >
          <span className="font-semibold text-ink">{p.web_name}</span>
          <span className="text-xs text-ink-muted">
            <span>{p.team_short_name}</span>
            <span className="ml-2">£{(p.now_cost / 10).toFixed(1)}m</span>
            <span className="ml-2" title={`${p.ppm.toFixed(2)}pts/min (last season)`}>{p.total_points}pts</span>
          </span>
        </div>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// ArchetypeCard — renders one of the three pre-season squad archetypes
// ---------------------------------------------------------------------------
function ArchetypeCard({ archetype }: { archetype: ArchetypeSquad }) {
  const { label, squad, topCaptains } = archetype

  return (
    <div
      className="rounded border border-line bg-surface-1 p-4 space-y-3"
      data-testid="archetype-card"
    >
      <h4 className="text-sm font-semibold text-ink">{label}</h4>

      {squad === null ? (
        <p className="text-xs text-warning">
          Could not build squad — try adjusting the budget.
        </p>
      ) : (
        <>
          <div className="text-xs text-ink-muted flex flex-wrap gap-2">
            <span><span className="font-semibold">Formation:</span> {squad.formation}</span>
            <span>│</span>
            <span><span className="font-semibold">Cost:</span> £{(squad.budgetUsed / 10).toFixed(1)}m</span>
          </div>

          {topCaptains.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase text-ink-muted mb-1">
                Captain options
              </p>
              {topCaptains.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between text-xs py-0.5">
                  <span className={i === 0 ? 'font-semibold text-ink' : 'text-ink-muted'}>
                    {c.web_name}
                  </span>
                  <span className="text-ink-muted">{c.total_points}pts</span>
                </div>
              ))}
            </div>
          )}

          {(() => {
            const allSquadPlayers = [...squad.starters, ...squad.bench]
            const starterIds = new Set(squad.starters.map(p => p.id))
            return POSITION_ORDER.map(pos => {
              const group = allSquadPlayers.filter(p => p.element_type === pos)
            if (group.length === 0) return null
            return (
              <div key={pos}>
                <p className="text-[10px] font-semibold uppercase text-ink-muted mb-0.5">
                  {POSITION_LABELS[pos]}
                </p>
                {group.map(p => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between text-xs py-0.5 border-b border-line ${!starterIds.has(p.id) ? 'opacity-50' : ''}`}
                  >
                    <span className="text-ink truncate">{p.web_name}</span>
                    <span className="text-ink-muted shrink-0 ml-2">
                      {p.team_short_name} £{(p.now_cost / 10).toFixed(1)}m
                    </span>
                  </div>
                ))}
              </div>
            )
            })
          })()}
        </>
      )}
    </div>
  )
}

// Health indicator — rendered after squadSection inside Section A (GREEDY-03).
// Three text variants per CONTEXT.md D-08 and UI-SPEC Copywriting Contract.
function HealthIndicator({ health }: { health: SquadHealth }) {
  if (health.greedy_null_rate === 0) {
    return (
      <p className="text-sm text-ink-muted py-2">
        Greedy success rate: 100% — all budgets feasible.
      </p>
    )
  }
  if (health.min_feasible_budget_greedy === null) {
    return (
      <p className="text-sm text-negative py-2">
        No feasible squad found across £{health.budget_sweep_min}m–£{health.budget_sweep_max}m range.
      </p>
    )
  }
  return (
    <p className="text-sm text-ink-muted py-2">
      Greedy success rate: {Math.round((1 - health.greedy_null_rate) * 100)}% across
      £{health.budget_sweep_min}m–£{health.budget_sweep_max}m budget sweep.
      {' '}Min feasible budget: £{health.min_feasible_budget_greedy.toFixed(1)}m.
    </p>
  )
}

export function NextSeasonPlannerTab() {
  const { data, isLoading, isError, error } = usePreSeasonSquad({ includeInputs: true })

  // Phase 128 AUTO-03: Activation status hook — 404→null (Awaiting), 200→Live.
  // Silent fallback: non-404 errors also return null (per UI-SPEC Interaction Contract).
  const { data: activeData } = usePreSeasonActive()
  const isActive = activeData !== null && activeData !== undefined
  const seasonId = activeData?.season_id ?? ''
  // dismissed state: initialised false; banner render condition reads localStorage synchronously
  // each render to avoid stale-init hazard (RESEARCH.md Pitfall 3 + Open Question 2).
  const [dismissed, setDismissed] = useState(false)

  // Phase 127 D-08: data is now PreSeasonSquadResponse | null
  const squad = data?.squad ?? null
  const health = data?.health ?? null
  const solver = data?.solver ?? null

  // Phase 129 (COST-01): Budget slider state + derived computations
  const inputs = data?.inputs ?? null
  const [sliderValue, setSliderValue] = useState<number>(100)
  const [committedBudget, setCommittedBudget] = useState<number>(100)
  const [testedBudget, setTestedBudget] = useState<number>(100)
  const deferredBudget = useDeferredValue(committedBudget)
  const [lastValidSquad, setLastValidSquad] = useState<PreSeasonSquad | null>(null)
  const [hasCommitted, setHasCommitted] = useState<boolean>(false)
  const keyboardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sliderValueRef = useRef(sliderValue)
  useEffect(() => { sliderValueRef.current = sliderValue }, [sliderValue])

  const scoreMapHydrated = useMemo<Map<number, number> | null>(() => {
    if (!inputs) return null
    return new Map(Object.entries(inputs.scoreMap).map(([k, v]) => [Number(k), v]))
  }, [inputs])

  const clientSquad = useMemo<PreSeasonSquad | null>(() => {
    if (!inputs || !scoreMapHydrated) return null
    return buildPreSeasonSquad(inputs.players, scoreMapHydrated, Math.round(deferredBudget * 10))
  }, [inputs, scoreMapHydrated, deferredBudget])

  const archetypes = useMemo(() => {
    if (!data?.inputs || !scoreMapHydrated || squad === null) return null
    return buildPreSeasonArchetypes(
      data.inputs.players,
      scoreMapHydrated,
      data.inputs.budget_default,
    )
  }, [data?.inputs, scoreMapHydrated, squad])

  useEffect(() => { if (clientSquad) setLastValidSquad(clientSquad) }, [clientSquad])
  useEffect(() => {
    setLastValidSquad(null)
    setHasCommitted(false)
  }, [data?.inputs])
  useEffect(() => () => { if (keyboardTimerRef.current) clearTimeout(keyboardTimerRef.current) }, [])

  // UIX-04: feasibility track tokens — warning marks the infeasible zone below
  // min_feasible_budget_greedy; ink-muted is the neutral remainder (ruling 3:
  // budget validity is a semantic state, never flattened to accent).
  const trackBackground = useMemo<string>(() => {
    if (!health) return 'var(--color-ink-muted)'
    const minFeasible = health.min_feasible_budget_greedy
    if (minFeasible === null) return 'var(--color-ink-muted)'
    const threshold = ((minFeasible - 80) / 40) * 100
    return `linear-gradient(to right, var(--color-warning) 0%, var(--color-warning) ${threshold}%, var(--color-ink-muted) ${threshold}%, var(--color-ink-muted) 100%)`
  }, [health])

  // Phase 129 (COST-01): Slider event handlers
  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    setSliderValue(Number(e.currentTarget.value))
  }
  const handlePointerUp = () => {
    const v = sliderValueRef.current
    setCommittedBudget(v)
    setTestedBudget(v)
    setHasCommitted(true)
  }
  const handleKeyUp = () => {
    if (keyboardTimerRef.current) clearTimeout(keyboardTimerRef.current)
    keyboardTimerRef.current = setTimeout(() => {
      const v = sliderValueRef.current
      setCommittedBudget(v)
      setTestedBudget(v)
      setHasCommitted(true)
    }, 300)
  }

  // --- SECTION A: Pre-Season Squad (NSP-04) ---
  let squadSection: ReactNode

  if (isLoading) {
    squadSection = (
      <p className="text-sm text-ink-muted py-4">Loading pre-season squad...</p>
    )
  } else if (isError) {
    // GREEDY-NULL: surface reason code when hook throws with infeasibility message.
    squadSection = (
      <p className="text-sm text-negative py-4">
        {error?.message ?? 'Failed to load pre-season squad'}. Check the pipeline output and refresh.
      </p>
    )
  } else if (data === null || data === undefined || squad === null) {
    // Archive absent (data===null = 404) or envelope present but no squad yet.
    // Note: data===null is the canonical "Prices pending" state (D-03).
    squadSection = (
      <p className="text-sm text-ink-muted py-4">
        Pre-season squad not yet available. The squad builder becomes available once the season archive is ready. Check back after GW38.
      </p>
    )
  } else {
    // squad is PreSeasonSquad — render formation grid (D-05)
    // Phase 129 D-06/D-07: before first commit show API squad; after commit show lastValidSquad (or API squad as fallback)
    const displaySquad: PreSeasonSquad = hasCommitted ? (lastValidSquad ?? squad) : squad
    squadSection = <FormationGrid squad={displaySquad} solver={solver} />
  }

  // --- SECTION B: GW1-8 FDR Heatmap (NSP-03) ---
  // GW1-8-FIXTURES is a known deferred condition: next-season fixture data is not available until
  // FPL publishes the schedule (typically late June). The empty-state branch is the expected render
  // path at ship time. The populated branch (HeatMapRow table) is the future-ready code path.
  // TODO(GW1-8-FIXTURES): when next-season fixture data is available, fetch it here and render
  // HeatMapRow rows inside a <table> instead of the empty-state paragraph below.
  const nextSeasonFixtures: unknown[] = [] // deferred: no fixture data available until FPL publishes
  const hasFixtures = nextSeasonFixtures.length > 0

  const heatmapSection: ReactNode = hasFixtures ? (
    // Future-ready: HeatMapRow is imported; populate grid/tierMap/ownedTeamIds from fixture data.
    <p className="text-sm text-ink-muted py-2">
      Fixture data ready — heatmap rendering.
    </p>
  ) : (
    <>
      <p className="text-sm text-ink-muted py-2">
        Fixtures not yet published for next season.
      </p>
      <p className="text-sm text-ink-muted">
        Next season&apos;s fixture list hasn&apos;t been released yet. Check back in late June.
      </p>
    </>
  )

  return (
    <div className="space-y-4">
      {/* Phase 128 AUTO-03: Status pill — render nothing during loading to avoid flash of wrong state */}
      {activeData !== undefined && (
        <div className="flex items-center gap-2 py-2">
          <span className={
            isActive
              ? "text-xs font-normal bg-positive-soft text-positive rounded px-2 py-1"
              : "text-xs font-normal bg-surface-2 text-ink-muted rounded px-2 py-1"
          }>
            {isActive ? 'Live' : 'Awaiting'}
          </span>
        </div>
      )}

      {/* Phase 128 AUTO-03: First-activation banner — shown only on first visit after activation.
          localStorage read is synchronous per render (not in useState init) to avoid stale-init
          with empty seasonId on first render (RESEARCH.md Pitfall 3 + Open Question 2).
          fplx_ prefix aligns with project localStorage key convention (RESEARCH.md Pitfall 5). */}
      {isActive && seasonId !== '' && !dismissed && typeof window !== 'undefined' &&
        localStorage.getItem(`fplx_nsp_activation_seen_${seasonId}`) !== 'true' && (
        <div className="rounded border border-positive/40 bg-positive-soft p-4 text-sm text-positive mb-4 flex items-start justify-between">
          <span>🏆 Pre-season is live — your squad has been re-optimised against the new FPL prices.</span>
          <button
            onClick={() => {
              localStorage.setItem(`fplx_nsp_activation_seen_${seasonId}`, 'true')
              setDismissed(true)
            }}
            className="ml-4 text-positive/70 hover:text-positive min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Dismiss activation banner"
          >
            ×
          </button>
        </div>
      )}

      {/* Section A: Pre-Season Squad */}
      <div>
        <h3 className="text-xl font-semibold">Pre-Season Squad</h3>
        {data?.inputs && data.squad != null && (
          <div className="py-2 min-h-[44px]">
            <label className="text-sm text-ink font-semibold">
              Budget: £{sliderValue.toFixed(1)}m
            </label>
            <input
              type="range"
              min={80}
              max={120}
              step={0.5}
              value={sliderValue}
              onChange={handleInput}
              onPointerUp={handlePointerUp}
              onKeyUp={handleKeyUp}
              className="w-full mt-2"
              style={{ background: trackBackground }}
              aria-label="Budget slider"
              aria-valuemin={80}
              aria-valuemax={120}
              aria-valuenow={sliderValue}
              aria-valuetext={`£${sliderValue.toFixed(1)}m`}
            />
          </div>
        )}
        {hasCommitted && clientSquad === null && (
          <p className="text-sm text-warning py-2">
            {health?.min_feasible_budget_greedy != null
              ? `No squad possible at £${testedBudget.toFixed(1)}m — try £${health.min_feasible_budget_greedy.toFixed(1)}m+`
              : `No squad possible at £${testedBudget.toFixed(1)}m`}
          </p>
        )}
        {squadSection}
        {/* Health indicator rendered after squadSection (GREEDY-03), not inside FormationGrid */}
        {health !== null && <HealthIndicator health={health} />}
      </div>

      {/* Section A2: Squad Archetypes — only when inputs and a valid API squad exist */}
      {archetypes && (
        <div>
          <h3 className="text-xl font-semibold mb-3">Squad Archetypes</h3>
          <p className="text-sm text-ink-muted mb-4">
            Three squad structures built from the same £{((data?.inputs?.budget_default ?? 1000) / 10).toFixed(0)}m budget.
            Captain options ranked by last-season points.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {archetypes.map(archetype => (
              <ArchetypeCard key={archetype.label} archetype={archetype} />
            ))}
          </div>
        </div>
      )}

      {/* Section B: GW1-8 FDR Heatmap */}
      <div>
        <h3 className="text-xl font-semibold">GW1&#x2013;8 Fixture Difficulty</h3>
        {heatmapSection}
      </div>
    </div>
  )
}
