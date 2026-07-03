'use client'
// TFR-01: Confirmed Transfers Ledger tab — Wikipedia-sourced, PL-club deals,
// grouped by club (Ins/Outs) with chronological toggle. UIX primitives only.

import React, { useState } from 'react'
import { useConfirmedTransfers } from '@/lib/hooks/useConfirmedTransfers'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { TeamBadge } from '@/components/shared/TeamBadge'
import type { TransferDeal, TransferGroup, ChronoTransfer } from '@/lib/types'

type View = 'by-club' | 'most-recent'

const VIEW_OPTIONS: { id: View; label: string }[] = [
  { id: 'by-club', label: 'By club' },
  { id: 'most-recent', label: 'Most recent' },
]

// ─── Deal row (shared by both views) ─────────────────────────────────────────

function DealRow({ deal }: { deal: TransferDeal }) {
  return (
    <div className="flex items-center gap-2 py-1 flex-wrap">
      <span className="text-body text-ink">{deal.player}</span>
      <Chip intent="neutral">{deal.fee}</Chip>
      {deal.kind === 'loan' && (
        <Chip intent="violet" variant="outline">LOAN</Chip>
      )}
      {deal.other_club && (
        <span className="text-data text-ink-muted">{deal.other_club}</span>
      )}
    </div>
  )
}

// ─── By-club view ─────────────────────────────────────────────────────────────

function ClubSection({ label, deals }: { label: string; deals: TransferDeal[] }) {
  return (
    <div className="space-y-0.5">
      <p className="text-data font-semibold text-ink-muted uppercase tracking-wide">{label}</p>
      {deals.length === 0 ? (
        <p className="text-data text-ink-muted py-1">—</p>
      ) : (
        deals.map((d, i) => <DealRow key={`${d.player}-${i}`} deal={d} />)
      )}
    </div>
  )
}

function GroupCard({ group }: { group: TransferGroup }) {
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <TeamBadge shortName={group.team_short_name} size={20} />
          {group.team_name}
        </span>
      }
    >
      <div className="grid sm:grid-cols-2 gap-4 pt-2">
        <ClubSection label="In ↓" deals={group.ins} />
        <ClubSection label="Out ↑" deals={group.outs} />
      </div>
    </Card>
  )
}

// ─── Most-recent / chronological view ────────────────────────────────────────

function ChronoRow({ transfer }: { transfer: ChronoTransfer }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-line last:border-0 flex-wrap">
      <span className="text-data text-ink-muted w-28 shrink-0">{transfer.date}</span>
      <span className="text-body text-ink">{transfer.player}</span>
      <span className="flex items-center gap-1 text-data text-ink-muted">
        {transfer.from_short ? <TeamBadge shortName={transfer.from_short} size={16} /> : transfer.from_club}
        <span aria-hidden>→</span>
        {transfer.to_short ? <TeamBadge shortName={transfer.to_short} size={16} /> : transfer.to_club}
      </span>
      <Chip intent="neutral">{transfer.fee}</Chip>
      {transfer.kind === 'loan' && (
        <Chip intent="violet" variant="outline">LOAN</Chip>
      )}
    </div>
  )
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

export function ConfirmedTransfersTab({ onOpenWindow }: { onOpenWindow: () => void }) {
  const { data, isNotAvailable } = useConfirmedTransfers()
  const [view, setView] = useState<View>('by-club')

  // Gate-off or no artifact yet
  if (isNotAvailable) {
    return (
      <section aria-label="Confirmed transfers">
        <EmptyState
          title="Confirmed transfers unavailable"
          hint="Confirmed transfers appear when the window is active"
        />
      </section>
    )
  }

  // No data yet (loading or error treated gracefully)
  if (!data) return null

  // Loaded but empty — no deals this window yet
  if (data.chronological.length === 0) {
    return (
      <section aria-label="Confirmed transfers">
        <Header data={data} onOpenWindow={onOpenWindow} />
        <EmptyState
          title="No confirmed deals yet"
          hint="No Premier League deals confirmed yet this window"
        />
      </section>
    )
  }

  return (
    <section aria-label="Confirmed transfers" className="space-y-4">
      <Header data={data} onOpenWindow={onOpenWindow} />
      <SegmentedToggle
        options={VIEW_OPTIONS}
        value={view}
        onChange={(v) => setView(v as View)}
        ariaLabel="Transfer view"
        size="sm"
      />

      {view === 'by-club' ? (
        <div className="space-y-4">
          {data.groups.map((group) => (
            <GroupCard key={group.team_id} group={group} />
          ))}
        </div>
      ) : (
        <div className="bg-surface-1 border border-line rounded-lg px-4 py-2">
          {data.chronological.map((t, i) => (
            <ChronoRow key={`${t.player}-${i}`} transfer={t} />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Header (provenance + cross-link) ────────────────────────────────────────

function Header({
  data,
  onOpenWindow,
}: {
  data: { scraped_at: string; window: string }
  onOpenWindow: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h2 className="text-h3 font-semibold text-ink">Confirmed Transfers</h2>
        {data.scraped_at && (
          <p className="text-data text-ink-muted">
            as of {new Date(data.scraped_at).toLocaleString()} · {data.window}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onOpenWindow}
      >
        Rumours &amp; speculation →
      </Button>
    </div>
  )
}
