'use client'

// PERF-01 (system audit 2026-07): code-split every non-landing tab.
// Before this, page.tsx statically imported all 24 tools — one ~312 KB-gz
// client chunk carrying Recharts + TanStack Table that the default `home`
// landing never uses. Each tab now loads on first open behind next/dynamic
// (ssr:false — the shell is a client SPA; tabs render no SSR content).
//
// page.test.tsx mocks THIS module (re-exporting its per-component vi.mocks),
// keeping the all-tools render sweep synchronous.
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/Skeleton'

const loading = () => <Skeleton className="h-40" />

export const CockpitTab = dynamic(
  () => import('@/components/cockpit/CockpitTab').then(m => m.CockpitTab),
  { ssr: false, loading })
export const WeeklyPicksTab = dynamic(
  () => import('@/components/weekly-picks/WeeklyPicksTab').then(m => m.WeeklyPicksTab),
  { ssr: false, loading })
export const LineupTab = dynamic(
  () => import('@/components/squad/LineupTab').then(m => m.LineupTab),
  { ssr: false, loading })
export const LiveGwTab = dynamic(
  () => import('@/components/squad/LiveGwTab').then(m => m.LiveGwTab),
  { ssr: false, loading })
export const ReviewHub = dynamic(
  () => import('@/components/squad/ReviewHub').then(m => m.ReviewHub),
  { ssr: false, loading })
export const TransferPanel = dynamic(
  () => import('@/components/transfers/TransferPanel').then(m => m.TransferPanel),
  { ssr: false, loading })
export const OptimiserPanel = dynamic(
  () => import('@/components/optimiser/OptimiserPanel').then(m => m.OptimiserPanel),
  { ssr: false, loading })
export const WatchlistTab = dynamic(
  () => import('@/components/watchlist/WatchlistTab').then(m => m.WatchlistTab),
  { ssr: false, loading })
export const RankSimTab = dynamic(
  () => import('@/components/planner/RankSimTab').then(m => m.RankSimTab),
  { ssr: false, loading })
export const RivalsTab = dynamic(
  () => import('@/components/rivals/RivalsTab').then(m => m.RivalsTab),
  { ssr: false, loading })
export const GemsHub = dynamic(
  () => import('@/components/gem-table/GemsHub').then(m => m.GemsHub),
  { ssr: false, loading })
export const InsightsTab = dynamic(
  () => import('@/components/insights/InsightsTab').then(m => m.InsightsTab),
  { ssr: false, loading })
export const DefConTables = dynamic(
  () => import('@/components/defcon/DefConTables').then(m => m.DefConTables),
  { ssr: false, loading })
export const SetPieceTakerPanel = dynamic(
  () => import('@/components/set-pieces/SetPieceTakerPanel').then(m => m.SetPieceTakerPanel),
  { ssr: false, loading })
export const ClubFormTab = dynamic(
  () => import('@/components/club-form/ClubFormTab').then(m => m.ClubFormTab),
  { ssr: false, loading })
export const PlannerTab = dynamic(
  () => import('@/components/planner/PlannerTab').then(m => m.PlannerTab),
  { ssr: false, loading })
export const ManualPlanTab = dynamic(
  () => import('@/components/planner/ManualPlanTab').then(m => m.ManualPlanTab),
  { ssr: false, loading })
export const RouteTreeTab = dynamic(
  () => import('@/components/planner/RouteTreeTab').then(m => m.RouteTreeTab),
  { ssr: false, loading })
export const WildcardBuilderTab = dynamic(
  () => import('@/components/planner/WildcardBuilderTab').then(m => m.WildcardBuilderTab),
  { ssr: false, loading })
export const PreSeasonTab = dynamic(
  () => import('@/components/next-season/PreSeasonTab').then(m => m.PreSeasonTab),
  { ssr: false, loading })
export const PricesTab = dynamic(
  () => import('@/components/price-changes/PricesTab').then(m => m.PricesTab),
  { ssr: false, loading })
export const AccuracyTab = dynamic(
  () => import('@/components/accuracy/AccuracyTab').then(m => m.AccuracyTab),
  { ssr: false, loading })
export const SeasonReviewTab = dynamic(
  () => import('@/components/season-review/SeasonReviewTab').then(m => m.SeasonReviewTab),
  { ssr: false, loading })
export const CaptainPicksPanel = dynamic(
  () => import('@/components/captaincy/CaptainPicksPanel').then(m => m.CaptainPicksPanel),
  { ssr: false, loading })
export const PlayerComparisonModal = dynamic(
  () => import('@/components/gem-table/PlayerComparisonModal').then(m => m.PlayerComparisonModal),
  { ssr: false })
