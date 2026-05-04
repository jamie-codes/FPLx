'use client'
// Phase 58 (ML-01, ML-02, ML-08): TanStack Query hook fetching rival mini-league data.
//
// Sources of truth:
//   - .planning/phases/058-mini-league-rival-tracker/058-CONTEXT.md §decisions D-05, D-12
//   - .planning/phases/058-mini-league-rival-tracker/058-RESEARCH.md §Pattern 1, §Common Pitfalls 1/3/5
//   - .planning/phases/058-mini-league-rival-tracker/058-RESEARCH.md §Open Questions Q1 (bare-proxy deadline-detection resolution)
//
// D-05 deviation: deadline gate runs CLIENT-SIDE in this queryFn (not in a route handler) per
//   the bare-proxy approach. See 058-01-PLAN.md Task 3 <deviation_rationale>. Spirit of D-05
//   (captainPlayerId is null pre-deadline) IS preserved; FPL API itself returns null picks
//   pre-deadline as a secondary safeguard.
//
// Security: T-58-01 mitigation — leagueId MUST be numeric. The /^\d+$/.test guard
// prevents URL injection through the [...proxy] path segment (mirrors useChipHistory.ts L42).
// Concurrency: T-58-02 mitigation — pLimit(3) inside the queryFn closure caps parallel
// requests at 3 (NOT module-level — would persist across re-fetches per RESEARCH §Anti-Patterns).
import pLimit from 'p-limit'
import { useQuery } from '@tanstack/react-query'
import {
  parseLeagueStandings,
  parseRivalPicks,
  parseRivalHistory,
  CHIP_NAMES,
} from '@/lib/rivals-adapter'
import { parseFPLBootstrap } from '@/lib/fpl-adapter'
import type { RivalEntry, RivalLeagueResult, RivalPick } from '@/lib/types'

const MAX_RIVALS = 20
const CONCURRENCY = 3

/**
 * Fetch the user's mini-league rivals (up to 20), each with picks + chip history,
 * and apply the post-deadline captain gate (D-05).
 *
 * @param leagueId   numeric mini-league ID (string from localStorage). Falsy/non-numeric -> query disabled.
 * @param userTeamId the user's FPL team/entry ID (string from localStorage 'fpl_team_id').
 *                   When provided AND found in the fetched standings, used to compute each
 *                   rival's `rankGap = rival.rank - userRank`. When null or not found,
 *                   `rankGap` falls back to 0 for all rivals (UI displays "0").
 */
export function useRivals(
  leagueId: string | null,
  userTeamId: string | null,
) {
  return useQuery<RivalLeagueResult>({
    queryKey: ['rivals', leagueId, userTeamId],
    queryFn: async () => {
      if (!leagueId) throw new Error('leagueId required')

      // Step 1: bootstrap — for current event + deadline_time (D-05).
      // CLIENT-SIDE deadline gate per <deviation_rationale> in this plan.
      const bootstrapRes = await fetch('/api/fpl/bootstrap-static/')
      if (!bootstrapRes.ok) throw new Error(`bootstrap fetch failed: ${bootstrapRes.status}`)
      const bootstrapRaw = await bootstrapRes.json()
      const bootstrapParsed = parseFPLBootstrap(bootstrapRaw)
      if (!bootstrapParsed.success) throw new Error('bootstrap shape invalid')
      const events = bootstrapParsed.data.events
      const currentEvent =
        events.find(e => e.is_current) ?? events.find(e => e.is_next)
      if (!currentEvent) throw new Error('No active gameweek found')
      const currentGw = currentEvent.id
      const deadlineMs = Date.parse(currentEvent.deadline_time)
      const isPostDeadline = !Number.isNaN(deadlineMs) && Date.now() >= deadlineMs

      // Step 2: standings.
      const stRes = await fetch(`/api/fpl/leagues-classic/${leagueId}/standings/`)
      if (!stRes.ok) throw new Error(`standings fetch failed: ${stRes.status}`)
      const stRaw = await stRes.json()
      const stParsed = parseLeagueStandings(stRaw)
      if (!stParsed.success) throw new Error('standings shape invalid')
      const page1 = stParsed.data.standings

      // ML-02: extract user's rank from the SAME standings response (no extra fetch).
      // Find the user's entry by matching against userTeamId. Falls back to null when
      // userTeamId is missing or the user is not in the first standings page.
      let userRank: number | null = null
      if (userTeamId && /^\d+$/.test(userTeamId)) {
        const userEntryNum = Number(userTeamId)
        const userEntry = page1.results.find(e => e.entry === userEntryNum)
        userRank = userEntry?.rank ?? null
      }

      // CR-01: use has_next from the API response to correctly detect truncation.
      // The old allEntries.length > MAX_RIVALS check was wrong — the API always
      // returns at most MAX_RIVALS (20) results per page, so has_next is the only
      // reliable signal that more pages exist.
      const leagueTruncated = page1.has_next === true || page1.results.length > MAX_RIVALS
      const capped = page1.results.slice(0, MAX_RIVALS)

      // Step 3: per-rival picks + history with p-limit(3) concurrency cap.
      const limit = pLimit(CONCURRENCY)
      const rivals = await Promise.all(
        capped.map(entry =>
          limit(async (): Promise<RivalEntry> => {
            const [picksRes, historyRes] = await Promise.all([
              fetch(`/api/fpl/entry/${entry.entry}/event/${currentGw}/picks/`),
              fetch(`/api/fpl/entry/${entry.entry}/history/`),
            ])

            // Picks may legitimately fail (e.g., manager not active this GW) — degrade gracefully.
            let picks: RivalPick[] = []
            let captainPlayerId: number | null = null
            if (picksRes.ok) {
              const picksRaw = await picksRes.json()
              const picksParsed = parseRivalPicks(picksRaw)
              if (picksParsed.success) {
                picks = picksParsed.data.picks
                if (isPostDeadline) {
                  const cap = picks.find(p => p.is_captain)
                  captainPlayerId = cap?.element ?? null
                }
              }
            }

            // History — chips remaining derivation (D-03 / RESEARCH §Chip History Parsing).
            let chipsRemaining: string[] = [...CHIP_NAMES]
            if (historyRes.ok) {
              const histRaw = await historyRes.json()
              const histParsed = parseRivalHistory(histRaw)
              if (histParsed.success) {
                const used = new Set(
                  (histParsed.data.chips ?? []).map(c => c.name),
                )
                chipsRemaining = CHIP_NAMES.filter(c => !used.has(c))
              }
            }

            // ML-02: rankGap = rival.rank - userRank when known; 0 fallback when unknown.
            const rankGap =
              typeof userRank === 'number' ? entry.rank - userRank : 0

            return {
              entryId:         entry.entry,
              entryName:       entry.entry_name,
              playerName:      entry.player_name,
              rank:            entry.rank,
              rankGap,
              picks,
              captainPlayerId,
              chipsRemaining,
            }
          }),
        ),
      )

      return { rivals, leagueTruncated }
    },
    enabled: !!leagueId && /^\d+$/.test(leagueId),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })
}
