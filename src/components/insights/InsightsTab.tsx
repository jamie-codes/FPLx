'use client'

import { useState } from 'react'
import { useInsights } from '@/lib/hooks/useInsights'
import { useGWIntel } from '@/lib/hooks/useGWIntel'
import type {
  Insight,
  SignalLabel,
  GWInsight,
  PositionOpportunityCard,
  RotationRiskCard,
  DGWBGWCard,
  FixtureRunCard,
} from '@/lib/types'

// Phase 79 D-04/D-05/D-06: signal_label is computed by the pipeline (NOT derived client-side).
// Maps below convert the 6-label vocabulary to Tailwind classes (per UI-SPEC §Color) and Unicode icons.

const SIGNAL_CLASSES: Record<SignalLabel, string> = {
  'Strong signal':   'bg-primary/10 text-primary border border-primary/30',
  'Hidden gem':      'bg-primary/10 text-primary border border-primary/30',
  'Watchlist':       'bg-surface-elevated text-foreground border border-border',
  'Weak signal':     'bg-surface-elevated text-muted border border-border',
  'Trap risk':       'bg-warning/10 text-warning border border-warning/30',
  'Regression risk': 'bg-warning/10 text-warning border border-warning/30',
}

const SIGNAL_ICONS: Record<SignalLabel, string> = {
  'Strong signal':   '▲',
  'Hidden gem':      '★',
  'Watchlist':       '●',
  'Weak signal':     '●',
  'Trap risk':       '⚠',
  'Regression risk': '⚠',
}

// Phase 79 D-10: Priority Insights first; then 4 categories. INS-04 names 3 categories
// but `captaincy` insights exist, so a 5th "Captaincy Insights" section is added (planner decision).
type SectionKey = 'priority' | 'defensive' | 'attacking' | 'player' | 'captaincy'
const SECTION_ORDER: SectionKey[] = ['priority', 'defensive', 'attacking', 'player', 'captaincy']
const SECTION_LABELS: Record<SectionKey, string> = {
  priority:  'Priority Insights',
  defensive: 'Defensive Patterns',
  attacking: 'Attacking Patterns',
  player:    'Player-Specific Patterns',
  captaincy: 'Captaincy Insights',
}

const PRIORITY_LIMIT = 5  // D-10: top 5 by confidence_pct
const DECISION_TOP_N = 3  // D-07: top 3 with entity lists

// ---------- Helpers ----------

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

// ---------- InsightCard (5 zones + methodology) ----------

function InsightCard({ insight }: { insight: Insight }) {
  const signalCls = SIGNAL_CLASSES[insight.signal_label] ?? SIGNAL_CLASSES['Weak signal']
  const icon = SIGNAL_ICONS[insight.signal_label] ?? '●'
  const fillPct = clampPct(insight.metric_value)
  const benchmarkPct = clampPct(insight.benchmark_value)

  return (
    <div className="rounded border border-border bg-surface p-4 space-y-2">
      {/* Zone 1: category badge row (D-15) */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{SECTION_LABELS[insight.category as SectionKey]}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${signalCls}`}>
          <span aria-hidden="true">{icon}</span>
          <span>{insight.signal_label}</span>
        </span>
      </div>

      {/* Zone 2: title (D-15) */}
      <h3 className="text-[15px] font-semibold leading-tight">{insight.title}</h3>

      {/* Zone 3: metric + progress bar (D-13, D-17) */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="tabular-nums text-3xl font-semibold leading-tight">
            {insight.metric_value.toFixed(1)}%
          </span>
          <span className="text-xs text-muted">{insight.metric_label}</span>
        </div>
        {/* Progress bar: overflow-hidden clips fill; benchmark span escapes clip as absolute sibling */}
        <div className="relative w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${fillPct}%` }}
          />
          <span
            className="absolute top-[-4px] w-px h-4 bg-muted"
            style={{ left: `${benchmarkPct}%` }}
            aria-label={`Benchmark ${benchmarkPct}%`}
          />
        </div>
      </div>

      {/* Zone 4: takeaway */}
      <p className="text-sm text-foreground">{insight.takeaway}</p>

      {/* Zone 5: action hint */}
      <p className="text-xs text-muted">{insight.action_hint}</p>

      {/* Methodology (INS-06, D-14) */}
      <details className="text-xs text-muted">
        <summary
          className="cursor-pointer select-none"
          aria-label={`Methodology for ${insight.title}`}
        >
          Methodology
        </summary>
        <p className="mt-1">
          Sample: {insight.sample_n}/{insight.sample_total} · {insight.gw_coverage} · Confidence: {insight.confidence_pct.toFixed(1)}%
        </p>
      </details>
    </div>
  )
}

// ---------- CollapsibleSection (D-11, D-12) ----------

function CollapsibleSection({
  label, count, children,
}: { label: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)  // D-11: starts expanded
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left text-lg font-semibold mb-2 min-h-[44px]"
        aria-expanded={open}
      >
        <span aria-hidden="true">{open ? '▼' : '▶'}</span>
        <span>{label}</span>
        <span className="text-xs text-muted rounded-full px-2 py-0.5 bg-surface-elevated">{count}</span>
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </div>
  )
}

// ---------- DecisionSummary (D-07, D-08, D-09) ----------

function DecisionSummary({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null
  const withEntities = insights
    .filter(i => i.player_ids.length > 0 || i.team_ids.length > 0)
    .sort((a, b) => b.confidence_pct - a.confidence_pct)
    .slice(0, DECISION_TOP_N)
  // D-07 fallback: if fewer than 3 have entity lists, fall back to top-3 by confidence overall
  const top3 =
    withEntities.length >= DECISION_TOP_N
      ? withEntities
      : [...insights].sort((a, b) => b.confidence_pct - a.confidence_pct).slice(0, DECISION_TOP_N)
  if (top3.length === 0) return null

  return (
    <div className="sticky top-[var(--nav-height,96px)] z-30 bg-surface/95 backdrop-blur-sm border-b border-border -mx-4 px-4 py-3 mb-4">
      <h2 className="text-sm font-semibold mb-2">Decision Summary</h2>
      <ul className="space-y-2">
        {top3.map(insight => (
          <li key={insight.id} className="text-sm flex flex-wrap items-center gap-2">
            <span className="text-foreground">{insight.action_hint}</span>
            {insight.player_names.map(name => (
              <span
                key={`p-${insight.id}-${name}`}
                className="rounded-full px-2 py-0.5 text-xs bg-surface-elevated text-foreground"
              >
                {name}
              </span>
            ))}
            {insight.team_names.map(team => (
              <span
                key={`t-${insight.id}-${team}`}
                className="rounded-full px-2 py-0.5 text-xs bg-surface-elevated text-foreground"
              >
                {team}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- Phase 80 GWI: GW-specific intelligence cards ----------

function PositionOpportunityCardView({ card }: { card: PositionOpportunityCard }) {
  return (
    <div className="rounded border border-border bg-surface p-4 space-y-2">
      <span className="text-xs text-muted">{card.gw_label}</span>
      <h3 className="text-[15px] font-semibold leading-tight">
        Position opportunity: {card.position}
      </h3>
      <p className="text-sm">{card.narrative}</p>
    </div>
  )
}

function RotationRiskCardView({ card }: { card: RotationRiskCard }) {
  return (
    <div className="rounded border border-border bg-surface p-4 space-y-2">
      <span className="text-xs text-muted">{card.gw_label}</span>
      <h3 className="text-[15px] font-semibold leading-tight">
        Rotation risk: {card.team_short_name}
      </h3>
      <p className="text-sm">
        {card.competition} fixture clash within 3 days of PL kickoff.
      </p>
      {card.table_stakes_label && (
        <p className="text-xs text-muted">Context: {card.table_stakes_label}</p>
      )}
    </div>
  )
}

function DGWBGWCardView({ card }: { card: DGWBGWCard }) {
  const kindLabel = card.is_dgw ? 'Double Gameweek' : 'Blank Gameweek'
  return (
    <div className="rounded border border-border bg-surface p-4 space-y-2">
      <span className="text-xs text-muted">{card.gw_label}</span>
      <h3 className="text-[15px] font-semibold leading-tight">
        {kindLabel}: {card.team_short_name}
      </h3>
      <p className="text-sm">
        {card.is_dgw
          ? 'Two PL fixtures this GW — combined xPts uplift available.'
          : 'No PL fixture this GW — 0 pts unless replaced.'}
      </p>
    </div>
  )
}

function XptsTrajectoryBar({
  gw_xpts, gw_numbers, is_dgw, current_gw_index,
}: {
  gw_xpts: number[]
  gw_numbers: number[]
  is_dgw: boolean[]
  current_gw_index: number
}) {
  const max = Math.max(...gw_xpts, 0.01)
  return (
    <div className="flex items-end h-10 gap-2" aria-label="3-GW xPts trajectory">
      {gw_xpts.map((x, i) => {
        const heightPx = Math.max(4, Math.min(32, Math.round((x / max) * 32)))
        const isCurrent = i === current_gw_index
        const fillCls = isCurrent ? 'bg-primary' : 'bg-surface-elevated'
        const dgwSuffix = is_dgw[i] ? '†' : ''
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <span
              className={`w-full ${fillCls} rounded-sm`}
              style={{ height: `${heightPx}px` }}
              aria-label={`GW${gw_numbers[i] ?? '?'}: ${x.toFixed(1)} projected xPts`}
            />
            <span className="text-xs text-muted">
              GW{gw_numbers[i] ?? '?'}{dgwSuffix}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function FixtureRunCardView({ card }: { card: FixtureRunCard }) {
  const hasDgw = card.is_dgw.some(Boolean)
  return (
    <div className="rounded border border-border bg-surface p-4 space-y-2">
      <span className="text-xs text-muted">{card.gw_label}</span>
      <h3 className="text-[15px] font-semibold leading-tight">{card.web_name}</h3>
      <p className="text-sm">{card.narrative}</p>
      <XptsTrajectoryBar
        gw_xpts={card.gw_xpts}
        gw_numbers={card.gw_numbers}
        is_dgw={card.is_dgw}
        current_gw_index={0}
      />
      {hasDgw && (
        <p className="text-xs text-muted">† Double Gameweek</p>
      )}
    </div>
  )
}

function GWCard({ card }: { card: GWInsight }) {
  switch (card.type) {
    case 'position_opportunity':
      return <PositionOpportunityCardView card={card} />
    case 'rotation_risk':
      return <RotationRiskCardView card={card} />
    case 'dgw_bgw':
      return <DGWBGWCardView card={card} />
    case 'fixture_run':
      return <FixtureRunCardView card={card} />
    default: {
      // Exhaustiveness check; unknown card types are dropped silently.
      const _never: never = card
      void _never
      return null
    }
  }
}

function GWIntelSection() {
  const { data, isLoading, error } = useGWIntel()
  const cards: GWInsight[] = data?.cards ?? []

  // GWI-05: ALWAYS render section wrapper — never return null.
  return (
    <CollapsibleSection label="This Gameweek" count={cards.length}>
      {isLoading && (
        <p className="text-sm text-muted">Loading GW insights…</p>
      )}
      {!isLoading && (error || cards.length === 0) && (
        <p className="text-sm text-muted">
          GW insights will appear once fixtures are confirmed.
        </p>
      )}
      {!isLoading && !error && cards.length > 0 && cards.map((card) => (
        <GWCard key={card.id} card={card} />
      ))}
    </CollapsibleSection>
  )
}

// ---------- InsightsTab (top-level) ----------

export function InsightsTab() {
  const { data, isLoading, error } = useInsights()

  // Compute season-insights derived data (only when data exists)
  const sortedByConfidence = data ? [...data].sort((a, b) => b.confidence_pct - a.confidence_pct) : []
  const priority = sortedByConfidence.slice(0, PRIORITY_LIMIT)

  const byCategory: Record<Exclude<SectionKey, 'priority'>, Insight[]> = {
    defensive: [],
    attacking: [],
    player:    [],
    captaincy: [],
  }
  if (data) {
    for (const insight of data) {
      const cat = insight.category as Exclude<SectionKey, 'priority'>
      if (cat in byCategory) {
        byCategory[cat].push(insight)
      } else {
        console.warn(`InsightsTab: unknown category "${cat}", insight ${insight.id} dropped`)
      }
    }
  }

  return (
    <section className="mt-6 space-y-6" aria-label="Insights">
      {/* Phase 80 D-07: GW intel section first, ALWAYS rendered (GWI-05). */}
      <GWIntelSection />

      {/* Season-pattern insights (Phase 79) — handles its own loading/error/empty state. */}
      {isLoading && (
        <p className="text-sm text-muted text-center py-8">
          Loading insights…
        </p>
      )}
      {!isLoading && error && (
        <p className="text-sm text-negative py-4">
          Failed to load insights. Check the pipeline output and refresh.
        </p>
      )}
      {!isLoading && !error && (!data || data.length === 0) && (
        <div className="space-y-2" aria-label="Insights not available">
          <h2 className="text-lg font-semibold">No insights available yet</h2>
          <p className="text-sm text-muted">
            Run the pipeline to generate pattern data for this season.
          </p>
        </div>
      )}
      {!isLoading && !error && data && data.length > 0 && (
        <>
          <DecisionSummary insights={data} />
          {SECTION_ORDER.map((key) => {
            const items = key === 'priority' ? priority : byCategory[key]
            if (items.length === 0) return null
            return (
              <CollapsibleSection key={key} label={SECTION_LABELS[key]} count={items.length}>
                {items.map((insight) => (
                  <InsightCard key={`${key}-${insight.id}`} insight={insight} />
                ))}
              </CollapsibleSection>
            )
          })}
          <p className="text-xs text-muted mt-4">
            Patterns shown only when seen in 10 or more fixtures.
          </p>
        </>
      )}
    </section>
  )
}
