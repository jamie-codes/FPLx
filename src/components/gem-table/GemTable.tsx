'use client'

import { useState, useMemo, useEffect, useCallback, Fragment } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type ExpandedState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useAccuracy, useNewsFlagEnabled } from '@/lib/hooks/useAccuracy'
import { computeNewsSeverity, type NewsSeverity } from '@/lib/newsSeverity'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
import { computeAllGemScores } from '@/lib/gem-score'
import type { PositionCode, ScoredPlayer } from '@/lib/types'
import { createColumns } from './columns'
import { PositionFilter } from './PositionFilter'
import { GwToggle, getColumnVisibility, type ViewPreset } from './GwToggle'
import { PresetToggle } from './PresetToggle'
import { LandscapeTip } from '@/components/set-pieces/LandscapeTip'
import { computeRejection } from '@/lib/explain'
import { computeFragility } from '@/lib/sensitivity'
import { FragilityBadge } from '@/components/shared/FragilityBadge'
import { ComparisonSearch } from '@/components/gem-table/ComparisonSearch'
import { PlayerInsightSection } from '@/components/shared/PlayerInsightSection'
import { ConfirmedSigningBadge } from '@/components/shared/ConfirmedSigningBadge'
import { useTransferNews } from '@/lib/hooks/useTransferNews'

// Phase 65 WHY-01: position-code label for adaptive-framing rejection-panel rendering.
const POSITION_CODES_LABEL: Record<number, string> = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
}

const HIDDEN_COLUMN_LABELS: Record<string, string> = {
  team_short_name: 'Team',
  now_cost: 'Price',
  fdr_score: 'FDR',
  form_score: 'Form',
  xg_per90: 'xG/90',
  xa_per90: 'xA/90',
  xg_score: 'xG Score',
  xa_score: 'xA Score',
  ownership_score: 'Own Score',
  minutes_score: 'Minutes',
  set_piece_score: 'Set Piece',
  selected_by_percent: 'Owned %',
  status: 'Status',
  trend: 'Price Trend',
  fixtures: 'Next 5',
  regression_signal: 'Signal',
  differential_flag: 'Diff',
}

// Phase 65 WHY-01: rejection panel renderer — adaptive framing (positive vs reasons list).
// Source: 065-UI-SPEC.md §WHY-01 §Component Specifications §Rejection panel structure.
function RejectionPanelInline({
  reasons,
  xPtsRank,
  posCodeLabel,
  xPts1gw,
}: {
  reasons: string[]
  xPtsRank: number
  posCodeLabel: string
  xPts1gw: number
}) {
  // Adaptive positive framing — reasons.length === 0 means computeRejection deemed the player strong.
  if (reasons.length === 0) {
    return (
      <p className="mt-2 text-xs text-green-700 dark:text-green-400">
        {`No rejection signals — ranked #${xPtsRank} at ${posCodeLabel} by xPts (${xPts1gw.toFixed(1)} pts projected)`}
      </p>
    )
  }
  // Rejection reasons list.
  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Why not recommended:</p>
      <ul className="space-y-0.5">
        {reasons.map((line, i) => (
          <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400">
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Phase 88 SCRAPER-01: row-expand news section helper (D-06).
const ROW_EXPAND_SEVERITY_CLASS: Record<NewsSeverity, string> = {
  red:   'text-red-600 dark:text-red-400',
  amber: 'text-amber-600 dark:text-amber-400',
  zinc:  'text-zinc-500 dark:text-zinc-400',
  none:  '',
}
const ROW_EXPAND_SEVERITY_ICON: Record<NewsSeverity, string> = { red: '⚠', amber: '⚠', zinc: 'ℹ', none: '' }

function RowExpandNewsSection({
  news,
  news_added,
  chance_of_playing_next_round,
  enabled,
}: {
  news: string | undefined
  news_added: string | undefined
  chance_of_playing_next_round: number | null | undefined
  enabled: boolean
}) {
  if (!enabled) return null
  if (!news || news.trim().length === 0) return null
  const severity = computeNewsSeverity(chance_of_playing_next_round, news)
  if (severity === 'none') return null
  const relTime = news_added ? formatRelativeTime(news_added) : null
  return (
    <div className={`mt-2 ${ROW_EXPAND_SEVERITY_CLASS[severity]} text-xs`} data-testid="row-expand-news">
      <span aria-hidden="true">{ROW_EXPAND_SEVERITY_ICON[severity]} </span>
      {news}
      {relTime && <span className="ml-1 text-zinc-400 dark:text-zinc-500">({relTime})</span>}
    </div>
  )
}

interface GemTableProps {
  preset?: ViewPreset
  onPresetChange?: (p: ViewPreset) => void
  onCompare?: (player: ScoredPlayer) => void
}

export function GemTable({ preset = 'default', onPresetChange, onCompare }: GemTableProps = {}) {
  const { data, isLoading, error } = usePlayers()

  // Phase 41 ACC-05: derive the most-recent backtest GW so the last_gw_actual_pts column header
  // can render "GW{N} Pts". Accuracy hook is cached at 6h staleTime — essentially free here.
  const { data: accuracyData } = useAccuracy()
  const lastGwActualGwN: number | null = accuracyData?.gws_covered?.[0] ?? null
  // Phase 105 NLP-02 (Pitfall 4): GemTable has no squad context for `gw`.
  // Source is the most-recent settled GW + 1 — same convention as Phase 101's
  // last_gw_actual_pts column header derivation. Off-by-one risk on Sunday
  // between deadline and pipeline rerun is accepted (one extra LLM spend at
  // most; no data corruption).
  const insightGw = (lastGwActualGwN ?? 0) + 1
  const newsFlagEnabled = useNewsFlagEnabled()
  // Phase 125 WIN-02 (D-12): confirmed signing badge lookup.
  // Unconditional call (rules-of-hooks); data access gated by isSuccess.
  const { data: transferNewsFeed } = useTransferNews()
  // Build a map: element_id → most-recent confirmed_signing article title+source for tooltip.
  const confirmedSigningMap = useMemo<Map<number, string>>(() => {
    const map = new Map<number, string>()
    const articles = transferNewsFeed?.articles ?? []
    // Sort descending by published/scraped_at so the first match is most-recent.
    const sorted = [...articles]
      .filter(a => a.classification === 'confirmed_signing' && a.element_id !== null)
      .sort((a, b) => {
        const aTime = new Date(a.published ?? a.scraped_at).getTime()
        const bTime = new Date(b.published ?? b.scraped_at).getTime()
        return bTime - aTime
      })
    for (const article of sorted) {
      if (article.element_id !== null && !map.has(article.element_id)) {
        const sourceLabel = article.source === 'skysports' ? 'Sky Sports' : 'BBC'
        map.set(article.element_id, `${article.title} · ${sourceLabel}`)
      }
    }
    return map
  }, [transferNewsFeed])

  const scoredPlayers = useMemo(() => computeAllGemScores(data ?? []), [data])

  const handleCompare = useCallback((player: ScoredPlayer) => {
    onCompare?.(player)
  }, [onCompare])

  const columns = useMemo(() => createColumns(handleCompare, lastGwActualGwN, newsFlagEnabled), [handleCompare, lastGwActualGwN, newsFlagEnabled])

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'gem_score', desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [activePosition, setActivePosition] = useState<PositionCode | null>(null)
  const [gwHorizon, setGwHorizon] = useState<1 | 3 | 5>(1)

  const [isMobile, setIsMobile] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 640)
      setIsPortrait(window.innerHeight > window.innerWidth)
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  const [showBackToTop, setShowBackToTop] = useState(false)
  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > window.innerHeight)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [actionSheetPlayer, setActionSheetPlayer] = useState<ScoredPlayer | null>(null)

  const columnVisibility: VisibilityState = getColumnVisibility(gwHorizon, isMobile, isMobile ? 'default' : preset)

  const table = useReactTable({
    data: scoredPlayers,
    columns,
    state: { sorting, columnFilters, columnVisibility, expanded },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  })

  const handlePositionChange = (code: PositionCode | null) => {
    setActivePosition(code)
    if (code === null) {
      setColumnFilters([])
    } else {
      setColumnFilters([{ id: 'element_type', value: code }])
    }
  }

  if (isLoading) {
    return <p className="text-gray-500 dark:text-zinc-400">Loading players...</p>
  }

  if (error) {
    return (
      <p className="text-red-500">
        Failed to load players: {error instanceof Error ? error.message : String(error)}
      </p>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Gem Ratings</h1>
      <div className="sticky top-0 sm:static z-40 bg-white dark:bg-zinc-900 py-2 -mx-4 px-4 flex justify-between items-center mb-2 border-b border-gray-100 dark:border-zinc-800 sm:border-0">
        <PositionFilter active={activePosition} onChange={handlePositionChange} />
        <div className="flex items-center gap-2">
          <PresetToggle
            preset={preset}
            onPresetChange={onPresetChange ?? ((p: ViewPreset) => {
              if (process.env.NODE_ENV !== 'production') {
                console.warn('GemTable: onPresetChange not provided; preset change ignored', p)
              }
            })}
          />
          <GwToggle value={gwHorizon} onChange={setGwHorizon} />
        </div>
      </div>
      <LandscapeTip isMobile={isMobile} isPortrait={isPortrait} />
      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-2">
        {table.getRowModel().rows.length} players
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-2 py-2.5 sm:py-1 font-semibold text-gray-700 dark:text-zinc-300 whitespace-nowrap min-h-[44px] ${
                      header.column.id === 'web_name'
                        ? 'sticky left-0 z-30 bg-white dark:bg-zinc-900'
                        : 'z-20'
                    } ${
                      header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                    }`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc'
                      ? ' \u25B2'
                      : header.column.getIsSorted() === 'desc'
                        ? ' \u25BC'
                        : null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <tr
                  className={`even:bg-gray-50 dark:even:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-zinc-700 cursor-pointer active:bg-blue-100`}
                  onClick={() => {
                    row.toggleExpanded()
                    if (isMobile) {
                      setActionSheetPlayer(row.original)
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={
                        cell.column.id === 'web_name'
                          ? 'px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-zinc-900'
                          : 'px-2 py-1 whitespace-nowrap'
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && (() => {
                  const rejection = computeRejection(row.original, scoredPlayers, new Map())
                  // WR-02 fix: extract fragility once and reuse for both mobile and desktop rows,
                  // eliminating duplicate computeFragility calls (computeRejection already calls it
                  // internally; this avoids a second call per expanded row).
                  const fragility = computeFragility(row.original, false)
                  const posCodeLabel = POSITION_CODES_LABEL[row.original.element_type] ?? '??'
                  return (
                    <>
                      {/* Mobile expand row — preserved + rejection panel appended (D-03) */}
                      <tr className="bg-blue-50 dark:bg-blue-950 sm:hidden">
                        <td colSpan={row.getVisibleCells().length} className="px-3 py-3">
                          {actionSheetPlayer?.id === row.original.id && (
                            <div className="flex gap-2 mt-1 sm:hidden">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onCompare?.(row.original)
                                  setActionSheetPlayer(null)
                                }}
                                className="text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1 cursor-pointer"
                              >
                                Compare
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActionSheetPlayer(null)
                                }}
                                className="text-xs text-zinc-400 dark:text-zinc-500 cursor-pointer"
                                aria-label="Dismiss"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            {row.getAllCells()
                              .filter(cell => HIDDEN_COLUMN_LABELS[cell.column.id])
                              .map(cell => (
                                <div key={cell.column.id} className="flex gap-1">
                                  <dt className="text-gray-500 dark:text-zinc-400 shrink-0">
                                    {HIDDEN_COLUMN_LABELS[cell.column.id]}:
                                  </dt>
                                  <dd className="font-medium truncate">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                  </dd>
                                </div>
                              ))
                            }
                          </dl>
                          {/* NEW: rejection panel appended below dl (D-03) */}
                          <RejectionPanelInline
                            reasons={rejection.reasons}
                            xPtsRank={rejection.xPtsRank}
                            posCodeLabel={posCodeLabel}
                            xPts1gw={row.original.xPts_1gw ?? 0}
                          />
                          <RowExpandNewsSection
                            news={row.original.news}
                            news_added={row.original.news_added}
                            chance_of_playing_next_round={row.original.chance_of_playing_next_round}
                            enabled={newsFlagEnabled}
                          />
                          {/* Phase 93 SENS-01 (D-10): FragilityBadge after RowExpandNewsSection — viewing surface, isTransfer=false */}
                          {fragility.tier !== 'robust' ? <FragilityBadge tier={fragility.tier} reasons={fragility.reasons} /> : null}
                          {/* Phase 94 WHY-01-B: head-to-head comparison search (D-10). State resets on row collapse.
                              Renders Y's rejection reasons that X does not share, per Plan 01 computeHeadToHead composition (SC-4). */}
                          <ComparisonSearch rowPlayer={row.original} allPlayers={scoredPlayers} />
                          {/* Phase 105 NLP-02 (D-04): AI insight section appended LAST in mobile expand row */}
                          <PlayerInsightSection
                            player={row.original}
                            gw={insightGw}
                            rejectionReasons={rejection.reasons}
                            fragility={{ tier: fragility.tier, reasons: fragility.reasons }}
                          />
                          {/* Phase 125 WIN-02 (D-10, D-13): Confirmed Signing badge — expanded row only, absent when unmatched */}
                          {confirmedSigningMap.has(row.original.id) && (
                            <div className="mt-2">
                              <ConfirmedSigningBadge title={confirmedSigningMap.get(row.original.id)} />
                            </div>
                          )}
                        </td>
                      </tr>
                      {/* NEW desktop expand row — rejection panel ONLY (D-02 + Pitfall 5: hidden sm:table-row) */}
                      <tr className="bg-blue-50 dark:bg-blue-950 hidden sm:table-row">
                        <td colSpan={row.getVisibleCells().length} className="px-3 py-3">
                          <RejectionPanelInline
                            reasons={rejection.reasons}
                            xPtsRank={rejection.xPtsRank}
                            posCodeLabel={posCodeLabel}
                            xPts1gw={row.original.xPts_1gw ?? 0}
                          />
                          <RowExpandNewsSection
                            news={row.original.news}
                            news_added={row.original.news_added}
                            chance_of_playing_next_round={row.original.chance_of_playing_next_round}
                            enabled={newsFlagEnabled}
                          />
                          {/* Phase 93 SENS-01 (D-10): FragilityBadge after RowExpandNewsSection — viewing surface, isTransfer=false */}
                          {fragility.tier !== 'robust' ? <FragilityBadge tier={fragility.tier} reasons={fragility.reasons} /> : null}
                          {/* Phase 94 WHY-01-B: head-to-head comparison search (D-10). State resets on row collapse.
                              Renders Y's rejection reasons that X does not share, per Plan 01 computeHeadToHead composition (SC-4). */}
                          <ComparisonSearch rowPlayer={row.original} allPlayers={scoredPlayers} />
                          {/* Phase 105 NLP-02 (D-04): AI insight section appended LAST in desktop expand row */}
                          <PlayerInsightSection
                            player={row.original}
                            gw={insightGw}
                            rejectionReasons={rejection.reasons}
                            fragility={{ tier: fragility.tier, reasons: fragility.reasons }}
                          />
                          {/* Phase 125 WIN-02 (D-10, D-13): Confirmed Signing badge — expanded row only, absent when unmatched */}
                          {confirmedSigningMap.has(row.original.id) && (
                            <div className="mt-2">
                              <ConfirmedSigningBadge title={confirmedSigningMap.get(row.original.id)} />
                            </div>
                          )}
                        </td>
                      </tr>
                    </>
                  )
                })()}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {isMobile && showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-24 right-4 z-50 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full w-10 h-10 flex items-center justify-center shadow-lg active:scale-95 transition-transform sm:hidden"
          aria-label="Back to top"
        >
          ↑
        </button>
      )}
    </div>
  )
}
