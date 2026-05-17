# Phase 119: UI Surfaces - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 119-ui-surfaces
**Areas discussed:** Status badge design, confirmed_start visibility, NewsBanner coexistence, Team News Alert placement

---

## Status Badge Design

| Option | Description | Selected |
|--------|-------------|----------|
| Colored pill | Rounded badge with background — red/amber/green per status. Same pattern as MinsRiskBadge/LifecycleLabelBadge. | ✓ |
| Colored text only | Inline colored text without background pill — like NewsBanner/FragilityNote. | |
| Icon only | Icon/emoji with tooltip, no text. Compact but less scannable. | |

**User's choice:** Colored pill (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Shared StatusLabelBadge | New `src/components/shared/StatusLabelBadge.tsx` reused by all surfaces. | ✓ |
| Inline per surface | Each component defines its own badge markup independently. | |

**User's choice:** Shared StatusLabelBadge (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Full label text | "confirmed absent", "doubted" — underscores replaced with spaces. | ✓ |
| Short label | "Start", "Doubt", "Out" — compact abbreviations. | |
| You decide | Claude picks label text based on existing badge patterns. | |

**User's choice:** Full label text (Recommended)
**Notes:** —

---

## confirmed_start Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Doubted + absent only | No green "confirmed start" badge — it's the expected baseline; avoid noise. | ✓ |
| All three statuses | Green badge for confirmed_start provides positive reassurance and confirms live data. | |

**User's choice:** Doubted + absent only (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing for unknown | unknown = no data → no badge. Consistent with Phase 118 D-03 (unknown = 1.0 factor). | ✓ |
| Show 'unknown' badge | Zinc/grey pill to indicate entry exists but no determination made. | |

**User's choice:** Nothing (Recommended)
**Notes:** —

---

## NewsBanner Coexistence

| Option | Description | Selected |
|--------|-------------|----------|
| Show both | StatusLabelBadge + NewsBanner coexist — different signal types (structured status vs. FPL text). | ✓ |
| Status badge replaces NewsBanner | Suppress NewsBanner when lineupNews available — cleaner but loses FPL text context. | |
| Status badge only when no FPL news | Show badge only when player has no FPL news field. | |

**User's choice:** Show both (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| useLineupNews hook inside CandidateRow | CandidateRow calls hook directly; cached query = zero extra fetches. | ✓ |
| Prop-drill lineupNewsMap | CaptainPicksPanel passes Map down to each CandidateRow. | |

**User's choice:** useLineupNews hook inside CandidateRow (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Prop-drill from caller | OpportunityCostTable receives lineupNewsMap? prop; callers thread it. Keeps table pure. | ✓ |
| useLineupNews hook inside OpportunityCostTable | Table fetches own data — breaks no-hooks-in-presentation convention. | |

**User's choice:** Prop-drill from caller (Recommended)
**Notes:** —

---

## Team News Alert Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Between grid and prose | Standalone section below 2×2 grid, above ProseSummaryBlock. Conditional. | ✓ |
| 5th card in grid | Appended to grid — orphaned on its own row; breaks 2×2 symmetry on desktop. | |
| Merged into Risk Flags | Team news inside existing Risk Flags card — mixes two distinct signal types. | |

**User's choice:** Between grid and prose (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| All 15 squad players | Full squad scope — bench availability matters for forced substitutions. | ✓ |
| Starting XI only | Only the 11 starters — bench less urgent. | |

**User's choice:** All 15 squad players (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| lineupNews Map | useLineupNews() data; filter by doubted/absent; 48h staleness already in hook. | ✓ |
| FPL news field | player.news + player.news_added (like NewsBanner); brings 14-day NEWS-01 gate. | |

**User's choice:** lineupNews Map (Recommended)
**Notes:** UI-03 requirements' "within 14 days" language refers to NEWS-01/NewsBanner (FPL text), not lineupNews. The 48h gate in useLineupNews covers staleness here.

---

## Claude's Discretion

None — all areas had explicit user selections.

## Deferred Ideas

None — discussion stayed within phase scope.
