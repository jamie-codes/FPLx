'use client'
// ACC-05: Forward Skill panel — leakage-free honest metrics from the BT-02 harness.
// ACC-06: honest xPts calibration table (live-state-only).
// UIX primitives and semantic tokens ONLY — zero raw palette values.
import type { HonestMetrics } from '@/lib/types'
import { Stat } from '@/components/ui/Stat'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { TableShell, Th, Td, TABLE_CLS, TR_CLS } from '@/components/ui/Table'
import { haulCaptureLabel } from '@/lib/picks'

// 2025/26 validation baseline constants — same values as ConfidenceStrip
const BASELINE: Required<Pick<HonestMetrics, 'top10_mean_pts' | 'haul_capture_20' | 'captain_return_rate'>> = {
  top10_mean_pts: 5.66,
  haul_capture_20: 0.194,
  captain_return_rate: 0.60,
}
const MIN_LIVE_GWS = 8

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${Math.round(v * 100)}%`
}

function fmtNum(v: number | null | undefined, dp = 2): string {
  if (v == null) return '—'
  return v.toFixed(dp)
}

// ============================================================================
// Per-GW table
// ============================================================================

type PerGwRow = NonNullable<HonestMetrics['per_gw']>[number]

function PerGwTable({ rows }: { rows: PerGwRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-data text-ink-muted">
        Per-gameweek detail appears once the season is underway.
      </p>
    )
  }
  return (
    <TableShell>
      <table className={TABLE_CLS} data-testid="forward-skill-per-gw">
        <thead>
          <tr>
            <Th>GW</Th>
            <Th>Haulers</Th>
            <Th>Hits</Th>
            <Th>Hit rate</Th>
            <Th>Top-10 pts</Th>
            <Th>Spearman</Th>
            <Th>Captain</Th>
            <Th>Cap pts</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.gw} className={TR_CLS}>
              <Td>GW{r.gw}</Td>
              <Td>{r.n_haulers}</Td>
              <Td>{r.haul_hits}</Td>
              <Td>{r.haul_hit_rate != null ? fmtPct(r.haul_hit_rate) : '—'}</Td>
              <Td>{r.top10_mean_pts.toFixed(1)}</Td>
              <Td>{r.spearman.toFixed(3)}</Td>
              <Td>{r.captain_name || '—'}</Td>
              <Td>{r.captain_actual}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

// ============================================================================
// By-position mini-table
// ============================================================================

type ByPosition = HonestMetrics['by_position']

const POSITIONS = ['GKP', 'DEF', 'MID', 'FWD'] as const

function ByPositionTable({ byPosition }: { byPosition: ByPosition }) {
  if (!byPosition) return null
  const rows = POSITIONS.filter((p) => byPosition[p] != null)
  if (rows.length === 0) return null
  return (
    <div>
      <p className="text-data font-medium text-ink-muted mb-2">RMSE by position</p>
      <TableShell>
        <table className={TABLE_CLS} data-testid="forward-skill-by-position">
          <thead>
            <tr>
              <Th>Position</Th>
              <Th>RMSE</Th>
              <Th>Haulers (n)</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((pos) => {
              const entry = byPosition[pos]
              return (
                <tr key={pos} className={TR_CLS}>
                  <Td>{pos}</Td>
                  <Td>{entry.rmse.toFixed(3)}</Td>
                  <Td>{entry.n_haulers}</Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableShell>
    </div>
  )
}

// ============================================================================
// ACC-06: Calibration table
// ============================================================================

type CalibBucket = NonNullable<HonestMetrics['calibration']>[number]

function binLabel(b: CalibBucket): string {
  return b.bin_hi === 99 ? `${b.bin_lo}+` : `${b.bin_lo}–${b.bin_hi}`
}

function CalibrationTable({ buckets }: { buckets: CalibBucket[] }) {
  return (
    <div>
      <p className="text-data font-medium text-ink-muted mb-2">xPts calibration</p>
      <TableShell>
        <table className={TABLE_CLS} data-testid="calibration-table">
          <thead>
            <tr>
              <Th>Bin</Th>
              <Th>n</Th>
              <Th>Predicted</Th>
              <Th>Actual</Th>
              <Th>Δ</Th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => {
              const delta = b.mean_actual - b.mean_pred
              return (
                <tr key={`${b.bin_lo}-${b.bin_hi}`} className={TR_CLS}>
                  <Td>{binLabel(b)}</Td>
                  <Td>{b.n}</Td>
                  <Td>{b.mean_pred.toFixed(2)}</Td>
                  <Td>{b.mean_actual.toFixed(2)}</Td>
                  <Td>{delta >= 0 ? '+' : ''}{delta.toFixed(2)}</Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableShell>
      <p className="text-data text-ink-muted mt-2">
        Each row is a predicted-xPts bucket; Δ = actual − predicted.
        Positive Δ = model under-predicted, negative = over-predicted.
      </p>
    </div>
  )
}

// ============================================================================
// Main panel
// ============================================================================

export function ForwardSkillPanel({ honest }: { honest: HonestMetrics | undefined }) {
  const live = honest != null && honest.n_gws >= MIN_LIVE_GWS
  const m = live ? honest : BASELINE

  const captureLabel = haulCaptureLabel(m.haul_capture_20)
  const captainReturnLabel = fmtPct(m.captain_return_rate)
  const rmseLabel = live ? fmtNum((honest as HonestMetrics).rmse, 3) : '—'
  const spearmanLabel = live ? fmtNum((honest as HonestMetrics).spearman, 3) : '—'

  const provenanceCaption = live
    ? `deploy mode · ${honest!.n_gws} GWs this season`
    : 'measured on 2025/26 — switches to live after GW8'

  const perGwRows = live ? (honest!.per_gw ?? []) : []
  const showPerGw = live

  return (
    <div data-testid="forward-skill-panel" className="space-y-4">
      <SectionHeader
        title="Forward Skill (leakage-free)"
        subtitle="what the model would have picked before each GW — the honest measure"
      />

      {/* Stat row */}
      <div className="flex flex-wrap gap-6">
        <Stat
          label="Haul capture (top-20)"
          value={captureLabel}
          data-testid="stat-haul-capture"
        />
        <Stat
          label="Top-10 weekly avg"
          value={m.top10_mean_pts != null ? `${m.top10_mean_pts.toFixed(1)} pts` : '—'}
          data-testid="stat-top10-mean"
        />
        <Stat
          label="Captain returns 6+"
          value={captainReturnLabel}
          data-testid="stat-captain-return"
        />
        <Stat
          label="RMSE"
          value={rmseLabel}
          data-testid="stat-rmse"
        />
        <Stat
          label="Spearman"
          value={spearmanLabel}
          data-testid="stat-spearman"
        />
      </div>

      {/* Per-GW table — live only */}
      {showPerGw ? (
        <div>
          <p className="text-data font-medium text-ink-muted mb-2">Per-gameweek breakdown</p>
          <PerGwTable rows={perGwRows} />
        </div>
      ) : (
        <p className="text-data text-ink-muted">
          Per-gameweek detail appears once the season is underway.
        </p>
      )}

      {/* By-position mini-table — live only */}
      {live && <ByPositionTable byPosition={(honest as HonestMetrics).by_position} />}

      {/* ACC-06: Calibration table — live only, only when buckets present */}
      {live && (honest as HonestMetrics).calibration != null && (honest as HonestMetrics).calibration!.length > 0 ? (
        <CalibrationTable buckets={(honest as HonestMetrics).calibration!} />
      ) : (
        <p className="text-data text-ink-muted">
          Calibration appears once the season is underway.
        </p>
      )}

      {/* Provenance / source caption */}
      <p className="text-data text-ink-muted border-t border-line pt-2">
        {provenanceCaption}
      </p>
    </div>
  )
}
