---
plan: 051-02
phase: 051-weekly-decision-summary
status: complete
wave: 2
completed: 2026-05-02
---

# 051-02 SUMMARY: DecisionSummaryTab + page.tsx Wiring

## What Was Built

A new "Decision" sub-tab in the Squad section, composing all v1.7 engines into a single read-only decision screen. The tab is the default Squad landing page.

### Files Created / Modified

| File | Action | Description |
|------|--------|-------------|
| `src/components/squad/DecisionSummaryTab.tsx` | Created (620 lines) | Four-card component with severity badges, all v1.7 engine wiring |
| `src/app/page.tsx` | Modified | SubTab union + SECTIONS + sectionMemory + conditional render |
| `src/app/page.test.tsx` | Modified | Updated for new default Squad sub-tab (Decision) |
| `src/components/nav/MobileNav.test.tsx` | Modified | Updated for 3-pill Squad nav (Decision | Transfers | Optimiser) |

## Component: DecisionSummaryTab

### Prop Signature (matches TransferPanel — Phase 43 D-11 contract)

```typescript
interface DecisionSummaryTabProps {
  teamId: string
  onTeamIdChange: (id: string) => void
  submittedId: string | null
  onSubmit: () => void
}
```

### Four Cards

| Card | Title | Severity Source | Engine |
|------|-------|----------------|--------|
| Captain Pick | "Captain Pick — GW {N}" | `severity.captain` | `computeCaptaincyCandidates()` |
| Transfer Options | "Transfer Options — 1 GW" | `severity.transfer` | `suggestTransfers()` + `computeOpportunityCostRows()` |
| Chip Timing | "Chip Timing" | `severity.chip` | `computeBBScore()`, `computeTCScore()`, `computeFHResult()` |
| Risk Flags | "Risk Flags" | `severity.risk` | `computeLifecycleLabels()` |

All severity values sourced exclusively from `computeDecisionSeverity()` (Plan 01) — no inline if/else severity logic in JSX.

### Private Helpers (re-declared in module scope)

- `CaptainTypeBadge` — Safe (blue) / Upside (amber) badge, mirrors CaptaincyPanel TYPE_MAP
- `SeverityBadge` — HIGH (red) / MEDIUM (amber) / LOW (zinc) badge per UI-SPEC §"Severity badge colors"
- `easeFill` — Verbatim from ChipStrategyPanel.tsx lines 22-29
- `EaseCellBar` — Simplified from ChipStrategyPanel (no `forceMuted` — unused chips filtered out)
- `NoSquadPlaceholder` — "Load your squad to see transfer and risk recommendations."

### Key Wiring Decisions

- **Captaincy candidates (no-squad fallback):** When `!squadData`, top-3 from `scoredPlayers` filtered to non-GK with `xPts_1gw > 0`, sorted desc, mapped to `CaptaincyCandidate` shape with `mins_risk === 'nailed' ? 'safe' : 'upside'`. Captain + Chip cards remain visible (WDS-04).
- **Transfer horizon:** Hard-coded `horizon: 1` per CONTEXT.md D-06. No FtToggle / GwToggle on this card.
- **FT annotation:** `"Using {N} free transfer(s) · detected from your team"` when authenticated; `"Using 1 free transfer (default)"` otherwise.
- **AuthModal wiring:** Stripped for v1 as specified in plan action item 14 — form has FPL Team ID input + Load Squad button only. A "FPL account connected — exact sell prices will be used." status line shows when authenticated.
- **Wildcard exclusion:** Not listed in chip rows (wildcard has no per-GW timing analysis — card surfaces timing-driven chip recommendations only). `hasAvailableChip` computed over bboost/3xc/freehit only.
- **hasRecommendedChip:** Any chip's bestGw (from `bbScores`, `tcScores`, `fhResult.bestGw`) equals `nextGw`.
- **DGW/BGW detection:** `isDGW = scoredPlayers.some(p => fixtureCountForGw(p, nextGw) >= 2)`; `isBGW = teamsWithFx.size <= 14` per D-18.

## page.tsx Changes

```typescript
// SubTab union: 'decision' inserted before 'transfers'
export type SubTab = ... | 'decision' | 'transfers' | 'optimiser'

// SECTIONS Squad entry: Decision first, default changed
{ id: 'squad', subTabs: [
    { id: 'decision', label: 'Decision', mobileLabel: 'Decision' },
    { id: 'transfers', ... },
    { id: 'optimiser', ... },
  ], defaultSubTab: 'decision' }

// sectionMemory initial value
{ ..., squad: 'decision' }

// New conditional render (before 'transfers' branch)
{activeSection === 'squad' && activeSubTab === 'decision' && (
  <DecisionSummaryTab teamId={teamId} onTeamIdChange={setTeamId}
    submittedId={submittedId} onSubmit={handleTeamIdSubmit} />
)}
```

Existing `'transfers'` and `'optimiser'` branches unchanged.

## Security

`grep -c "dangerouslySetInnerHTML" src/components/squad/DecisionSummaryTab.tsx` → **0** (T-051-11 mitigation confirmed).

All untrusted strings (web_name, team_short_name, lifecycle labels) render as React JSX text children only — never via dangerouslySetInnerHTML.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (Phase 51 files) | 0 errors |
| `npx vitest run` (full suite) | 588 passed, 1 pre-existing club-form failure |
| `npx vitest run src/lib/__tests__/decision-severity.test.ts` | 21/21 passed |
| Human verify (WDS-01..WDS-05) | Approved 2026-05-02 |

## Commits

| SHA | Message |
|-----|---------|
| `4e0d98d` | `feat(051-02): add DecisionSummaryTab component composing v1.7 engines for WDS-01..WDS-05` |
| `b4561d2` | `feat(051-02): wire Decision sub-tab into page.tsx (default Squad landing — D-10)` |
| `85de382` | `chore: merge executor worktree (051-02 DecisionSummaryTab + page.tsx)` |

## Self-Check: PASSED
