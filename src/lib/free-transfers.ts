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
