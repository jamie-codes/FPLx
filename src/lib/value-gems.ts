import type { MergedPlayer } from '@/lib/types'

/** VAL-01: Cheap gem = now_cost / 10 <= 6.0 (i.e. now_cost <= 60) */
export function isCheapGem(player: Pick<MergedPlayer, 'now_cost'>): boolean {
  return player.now_cost / 10 <= 6.0
}

/** VAL-02: Low-owned = parseFloat(selected_by_percent) < 10 */
export function isLowOwned(player: Pick<MergedPlayer, 'selected_by_percent'>): boolean {
  return parseFloat(player.selected_by_percent) < 10
}
