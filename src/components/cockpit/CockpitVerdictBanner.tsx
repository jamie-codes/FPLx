'use client'

// Redesign Phase 3 (Cockpit): the one-sentence "what should I do this week?"
// verdict, composed from transfer advice (TRF-01), captain picks, and chip
// advice (CHP-01). Volt left border + projected-gain sub-line. buildVerdict is
// a pure function so the composition logic is unit-testable without hook mocks.
import { useMemo } from 'react'
import { useTransferAdvice } from '@/lib/hooks/useTransferAdvice'
import { useChipAdvice } from '@/lib/hooks/useChipAdvice'
import { useCaptainPicks } from '@/lib/hooks/useCaptainPicks'
import { useSquad } from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { bankedFreeTransfers } from '@/lib/free-transfers'
import {
  suggestValidatedTransfers, picksToSquadCandidates, mergedToCandidates,
} from '@/lib/validated-transfer-advisor'
import type { TransferAdvice, ChipAdvice, CaptainPicks, ChipAdviceEntry } from '@/lib/types'

const CHIP_LABELS: Record<string, string> = {
  bench_boost: 'Bench Boost',
  triple_captain: 'Triple Captain',
  free_hit: 'Free Hit',
  wildcard: 'Wildcard',
}

/** Minimal shape shared by the pipeline advice and the user-squad advisor. */
type VerdictTransfer = {
  hold: boolean
  moves: Array<{ out: { name: string }; in: { name: string } }>
  predicted_gain: number
}

export function buildVerdict(
  transfer: VerdictTransfer | TransferAdvice | undefined,
  chip: ChipAdvice | undefined,
  captain: CaptainPicks | undefined,
  opts: { isModelSquad?: boolean } = {},
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
      // VERDICT-01: say whose squad this is about. Unqualified, model-squad
      // advice reads as personal and names players the user does not own.
      const whose = opts.isModelSquad ? ' for the model squad' : ''
      clauses.push(
        `make ${count} transfer${n > 1 ? 's' : ''}${whose} (${first.out.name} → ${first.in.name}${extra})`)
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

export function CockpitVerdictBanner({ submittedId = null }: { submittedId?: string | null }) {
  const { data: transfer } = useTransferAdvice()
  const { data: chip } = useChipAdvice()
  const { data: captain } = useCaptainPicks()
  const { data: squadData } = useSquad(submittedId)
  const { data: playersData } = usePlayers()
  const { isAuthenticated } = useAuthStatus()
  const { data: myTeam } = useMyTeam(isAuthenticated && !!submittedId)

  // VERDICT-01 (2026-09-02): when a team is loaded, the verdict must be about
  // THAT squad. It previously always used transfer_advice.json, which the
  // pipeline builds from its own simulated model squad — so the headline named
  // players the user had never owned.
  const userAdvice = useMemo(() => {
    if (!squadData?.picks?.length || !playersData?.length) return null
    const sellPrices = myTeam?.picks
      ? new Map(myTeam.picks.map(p => [p.element, p.selling_price]))
      : undefined
    const squad = picksToSquadCandidates(squadData.picks, playersData, sellPrices)
    const bank = squadData.entry_history?.bank ?? 0
    const advice = suggestValidatedTransfers(squad, mergedToCandidates(playersData), {
      freeTransfers: bankedFreeTransfers(myTeam, squadData.active_chip),
      budget: squad.reduce((sum, p) => sum + p.cost, 0) + bank,
    })
    return {
      hold: advice.hold,
      moves: advice.moves,
      predicted_gain: advice.predictedGain,
    }
  }, [squadData, playersData, myTeam])

  const isModelSquad = userAdvice === null
  const verdict = buildVerdict(userAdvice ?? transfer, chip, captain, { isModelSquad })
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
