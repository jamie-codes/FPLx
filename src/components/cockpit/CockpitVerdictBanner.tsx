'use client'

// Redesign Phase 3 (Cockpit): the one-sentence "what should I do this week?"
// verdict, composed from transfer advice (TRF-01), captain picks, and chip
// advice (CHP-01). Volt left border + projected-gain sub-line. buildVerdict is
// a pure function so the composition logic is unit-testable without hook mocks.
import { useTransferAdvice } from '@/lib/hooks/useTransferAdvice'
import { useChipAdvice } from '@/lib/hooks/useChipAdvice'
import { useCaptainPicks } from '@/lib/hooks/useCaptainPicks'
import type { TransferAdvice, ChipAdvice, CaptainPicks, ChipAdviceEntry } from '@/lib/types'

const CHIP_LABELS: Record<string, string> = {
  bench_boost: 'Bench Boost',
  triple_captain: 'Triple Captain',
  free_hit: 'Free Hit',
  wildcard: 'Wildcard',
}

export function buildVerdict(
  transfer: TransferAdvice | undefined,
  chip: ChipAdvice | undefined,
  captain: CaptainPicks | undefined,
): { sentence: string; gain: number | null } | null {
  const clauses: string[] = []

  if (transfer) {
    if (transfer.hold || transfer.moves.length === 0) {
      clauses.push('hold — no transfer')
    } else {
      const n = transfer.moves.length
      const first = transfer.moves[0]
      const count = n === 1 ? 'one' : String(n)
      const extra = n > 1 ? ', …' : ''
      clauses.push(`make ${count} transfer${n > 1 ? 's' : ''} (${first.out.name} → ${first.in.name}${extra})`)
    }
  }

  if (captain?.ceiling) clauses.push(`captain ${captain.ceiling.name}`)

  if (chip) {
    const playing = (Object.entries(chip.chips) as [string, ChipAdviceEntry][])
      .filter(([, e]) => e.signal === 'play')
      .map(([k]) => CHIP_LABELS[k] ?? k)
    clauses.push(playing.length ? `play ${playing.join(' + ')}` : 'hold all chips')
  }

  if (clauses.length === 0) return null

  const joined = clauses.join(', ')
  const sentence = joined.charAt(0).toUpperCase() + joined.slice(1) + '.'
  const gain = transfer && !transfer.hold && transfer.moves.length > 0 ? transfer.predicted_gain : null
  return { sentence, gain }
}

export function CockpitVerdictBanner() {
  const { data: transfer } = useTransferAdvice()
  const { data: chip } = useChipAdvice()
  const { data: captain } = useCaptainPicks()

  const verdict = buildVerdict(transfer, chip, captain)
  if (!verdict) return null

  return (
    <section className="bg-surface-1 border border-line border-l-4 border-l-accent rounded-lg p-4">
      <div className="text-data uppercase tracking-wide text-ink-muted">This week&apos;s verdict</div>
      <p className="text-h4 font-semibold text-ink mt-1">{verdict.sentence}</p>
      {verdict.gain != null && (
        <p className="text-body text-ink-muted mt-1">
          Projected gain{' '}
          <span className="text-accent font-medium tabular">+{verdict.gain.toFixed(1)} xPts</span>{' '}
          over 5 GWs vs rolling.
        </p>
      )}
    </section>
  )
}
