// Free-transfer count derivation — extracted from the (previously duplicated)
// inline rule in TransferPanel + DecisionSummaryTab. FPL banks up to 2 FTs: a
// gameweek with 0 transfers made banks to 2, otherwise 1. Wildcard/Free Hit
// weeks neither consume nor bank an FT → treat as 1. Authenticated source only;
// callers pass null when unauthenticated (TransferPanel then uses its manual
// free-transfer input; DecisionSummaryTab defaults to 1).
import type { MyTeamResponse } from './squad-adapter'

export function deriveFreeTransfers(
  myTeam: MyTeamResponse | null | undefined,
  activeChip: string | null | undefined,
): 1 | 2 {
  if (!myTeam) return 1
  if (activeChip === 'wildcard' || activeChip === 'freehit') return 1
  return myTeam.entry_history.event_transfers === 0 ? 2 : 1
}

/** FPL 2026/27 banks up to five free transfers, and keeps them through a chip.
 * Prefer the authoritative `transfers.limit` from /my-team/; fall back to the
 * legacy 1-or-2 inference when it is absent (unauthenticated or old cache). */
export const MAX_BANKED_FREE_TRANSFERS = 5

export function bankedFreeTransfers(
  myTeam: MyTeamResponse | null | undefined,
  activeChip: string | null | undefined,
): number {
  const limit = myTeam?.transfers?.limit
  if (typeof limit === 'number' && limit >= 0) {
    return Math.min(limit, MAX_BANKED_FREE_TRANSFERS)
  }
  return deriveFreeTransfers(myTeam, activeChip)
}
