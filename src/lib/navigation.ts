// UIX-01: single source of truth for the app's navigation.
// The 27 tool ids are the pre-overhaul SubTab ids — every one must appear
// exactly once (navigation.test.ts enforces against this list).
// Group icons are lucide-react component references (UIX-01 audit batch 2) —
// this module is only consumed client-side, so holding a component here is
// fine; consumers render <group.icon size={...} strokeWidth={2} /> and the
// SVGs inherit currentColor, following the ink/accent token states for free.
// (lucide v1 renamed Home → House and BarChart3 → ChartColumn — same glyphs.)
import { House, Zap, Shirt, Search, CalendarDays, ChartColumn, type LucideIcon } from 'lucide-react'

export type ToolId =
  | 'home'
  | 'cockpit'   // absorbs the retired 'decision' tab (product-audit 2026-07)
  | 'picks' | 'lineup' | 'live' | 'review'
  | 'transfers' | 'optimiser' | 'watchlist' | 'rank-sim' | 'rivals'
  // merges (product-audit 2026-07): value-gems -> gems section; window/
  // transfers-confirmed/next-season -> pre-season; price-reset/price-changes -> prices
  | 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'club-form'   // perfect-gw -> review section
  | 'planner' | 'manual-plan' | 'route-tree' | 'wildcard' | 'pre-season' | 'prices'
  | 'accuracy' | 'season'

export interface Tool {
  id: ToolId
  label: string
  mobileLabel: string
  /** Kept routable (deep links, legacy aliases) but omitted from the nav.
   * Used for tools that are only relevant in part of the season — hiding
   * beats deleting, because old links keep working (2026-09-01). */
  hidden?: boolean
}
export interface Group { id: string; label: string; icon: LucideIcon; tools: Tool[] }

export const GROUPS: Group[] = [
  { id: 'home', label: 'Home', icon: House, tools: [
    { id: 'home', label: 'Home', mobileLabel: 'Home' },
  ]},
  { id: 'this-week', label: 'This Week', icon: Zap, tools: [
    { id: 'cockpit',  label: 'Cockpit',      mobileLabel: 'Cockpit' },
    { id: 'picks',    label: 'Weekly Picks', mobileLabel: 'Picks' },
    { id: 'lineup',   label: 'Lineup',       mobileLabel: 'Lineup' },
    { id: 'live',     label: 'Live',         mobileLabel: 'Live' },
    { id: 'review',   label: 'Review',       mobileLabel: 'Review' },
  ]},
  { id: 'my-squad', label: 'My Squad', icon: Shirt, tools: [
    { id: 'transfers', label: 'Transfers', mobileLabel: 'Transfers' },
    { id: 'optimiser', label: 'Optimiser', mobileLabel: 'Optimiser' },
    { id: 'watchlist', label: 'Watchlist', mobileLabel: 'Watchlist' },
    { id: 'rank-sim',  label: 'Rank Sim',  mobileLabel: 'Rank Sim' },
    { id: 'rivals',    label: 'Rivals',    mobileLabel: 'Rivals' },
  ]},
  { id: 'research', label: 'Research', icon: Search, tools: [
    { id: 'gems',       label: 'Gem Ratings',     mobileLabel: 'Gems' },
    { id: 'insights',   label: 'Insights',        mobileLabel: 'Insights' },
    { id: 'defcon',     label: 'DefCon Analysis', mobileLabel: 'DefCon' },
    { id: 'set-pieces', label: 'Set Pieces',      mobileLabel: 'SP' },
    { id: 'club-form',  label: 'Club Form',       mobileLabel: 'Form' },
  ]},
  { id: 'planning', label: 'Planning', icon: CalendarDays, tools: [
    { id: 'planner',       label: 'Planner',       mobileLabel: 'Planner' },
    { id: 'manual-plan',   label: 'Manual Plan',   mobileLabel: 'Manual' },
    { id: 'route-tree',    label: 'Route Tree',    mobileLabel: 'Routes' },
    { id: 'wildcard',   label: 'Wildcard',   mobileLabel: 'Wildcard' },
    // Hidden from 2026-09-01: the season is underway, so pre-season planning
    // is noise. Still routable via ?t=pre-season and the window /
    // transfers-confirmed / next-season legacy aliases.
    { id: 'pre-season', label: 'Pre-Season', mobileLabel: 'Pre-Season', hidden: true },
    { id: 'prices',     label: 'Prices',     mobileLabel: 'Prices' },
  ]},
  { id: 'model', label: 'Model', icon: ChartColumn, tools: [
    { id: 'accuracy', label: 'Accuracy', mobileLabel: 'Acc' },
    { id: 'season',   label: 'Season',   mobileLabel: 'Season' },
  ]},
]

/** Every tool id, including hidden ones — deep links and the ?t= parser must
 * still resolve a hidden tool. */
export const ALL_TOOL_IDS: ToolId[] = GROUPS.flatMap((g) => g.tools.map((t) => t.id))

/** What the navigation should actually render. */
export const visibleTools = (group: Group): Tool[] => group.tools.filter((t) => !t.hidden)

export function groupOf(toolId: ToolId): Group {
  return GROUPS.find((g) => g.tools.some((t) => t.id === toolId)) ?? GROUPS[0]
}
