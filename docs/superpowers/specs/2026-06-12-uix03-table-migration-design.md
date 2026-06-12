# UIX-03: Research/This Week Table Migration

**Feature ID:** UIX-03 (UI overhaul phase 3/5)
**Date:** 2026-06-12
**Status:** Approved
**Depends on:** UIX-01 primitives/tokens (shipped), UIX-02 (shipped). Inventory contract: `2026-06-12-uix01-feature-inventory.md`.

---

## Goal

Migrate the five player-table surfaces — DefCon, Value Gems, Weekly Picks, Set Pieces, Gem Ratings — onto the UIX-01 primitives: `PlayerCell` identity columns (headshots + badges), `TableShell/Th/Td` chrome, `Chip` badges, semantic tokens everywhere. Zero functional change: every interaction in the feature inventory survives byte-for-byte in behaviour.

## Stage 0 — primitive extensions (build + test FIRST)

### TableShell sticky-first-column

`TableShell` gains `stickyFirstCol?: boolean`; `Th`/`Td` gain `sticky?: boolean`. Contract (ports GemTable's load-bearing mechanics):
- Sticky `Th`: `sticky left-0 z-30 bg-surface-1`; non-sticky header cells `z-20` (when the table also uses stickyHeader); sticky `Td`: `sticky left-0 z-10 bg-surface-1`
- The background MUST be the opaque `surface-1` token (content scrolls beneath); zebra rows: the sticky cell keeps `bg-surface-1` (accepting the zebra seam GemTable already has today)
- Documented z-tier stack: sticky td (10) < header (20) < sticky th (30) < floating hover cards (50). Hover cards inside the scroll container must keep working — the wrapper stays `overflow-x-auto` exactly as GemTable's current wrapper does (GemTable's XPtsCell hover already coexists with overflow; preserve, don't "fix")

### Chip extensions

- New intent `violet`: token pair `--sp-violet` light `#7c3aed` / dark `#a78bfa` + `-soft` fills (light rgba(124,58,237,0.10), dark rgba(167,139,250,0.14)) — added to globals.css, exposed as utilities, **added to `scripts/contrast-check.mjs`** (must pass ≥4.5 on soft∘surface-1 both themes; darken/lighten until it does and record final values)
- New prop `variant?: 'solid' | 'outline'` (default solid = current). `outline`: transparent bg, 1px intent border, intent ink — for RoutePills' stat pills

### SegmentedToggle (new primitive, `src/components/ui/SegmentedToggle.tsx`)

`{ options: {id, label}[], value, onChange, size?: 'sm'|'md', ariaLabel }` — button-based segmented control, `aria-pressed`, active = `bg-ink text-surface-1` (the existing GwToggle visual convention, tokenized), `min-h-[32px]` sm / 44 md, keyboard arrows optional (buttons tab naturally). Replaces: GwToggle, PositionFilter, ValueGems filter pills, SetPieceViewToggle (each keeps its own option lists/semantics; only the control unifies).

## Badge policy (from the code survey)

**Collapse into Chip** (clean mapping):

| Badge | Mapping |
|---|---|
| DifferentialBadge | DIFF→positive, TRAP→warning, none→bare em-dash |
| RegressionSignalBadge | BUY→positive, SELL→warning |
| ConfirmedSigningBadge | positive (keep its title tooltip) |
| RotationRiskBadge | warning |
| DeliveryQualityBadge (set-pieces) | Elite→positive, Good→neutral, Weak→warning |
| "Changed" pill (set-pieces) | warning |
| GemTable inline status pill | d→warning, i/s→negative, u/n→neutral |
| VarianceBadge | ⬆ceiling→violet, =consistent→neutral |

Wrappers may remain as thin components delegating to Chip (keeps call sites stable) — implementer's choice per site; behaviour identical.

**Stay bespoke, internals retokenized** (semantics don't fit 6 intents / pill shape):
- MinsRiskBadge (5 tones: re-map blue→accent, orange→warning internally; keep its RiskChip stacking)
- FragilityBadge (deliberately text-only — its Pitfall-4 comment forbids pills; tokens only)
- RoutePillsCell (PK/FK/CK solid + xG/xA outline → use Chip solid/outline where shapes fit, else token-pure custom spans; keep the 5-colour distinction with PK→negative, FK→warning, CK→positive, xG→accent outline, xA→violet outline)
- FixtureBadges (grouped DGW-aware layout; retokenize internals: easy→positive-soft, medium→warning-soft, hard→negative-soft, DGW label→violet)

## Migration order + per-tab scope (easiest → hardest)

1. **DefCon** (`defcon/DefConTables.tsx` + columns): TableShell/Th/Td, tokens, red/green distance colouring → positive/negative tokens. PlayerCell IF the defcon stats rows carry/can-join `code`/`team_code` (join via usePlayers by id if cheap; else name+team text retokenized — decide at plan time, document).
2. **Value Gems** (`value-gems/`): TableShell, PlayerCell identity column (MergedPlayer has `code`/`team_code`), filter pills → SegmentedToggle, PriceTrendCell retokenized (note: it duplicates GemTable's trend cell — unify into one shared cell component during this step).
3. **Weekly Picks** (`weekly-picks/PicksTable.tsx`): local TABLE_CLS → TableShell/Th/Td (delete local constants), PlayerCell rows (drop the manual pos/team text — PlayerCell meta covers it), status ⚠ → Chip warning sm, keep conditional Haul column/colSpan and ExpandedPanel exactly.
4. **Set Pieces**: league table → TableShell + tokens (keep responsive `hidden sm/md/lg:table-cell` — TableShell doesn't model it and doesn't need to); taker cards → `Card` primitive; local badges → Chip per the table. **No PlayerCell** (team-level surface).
5. **Gem Ratings** (flagship, last): TanStack engine and ALL interactions untouched. Chrome: wrapper → TableShell(stickyFirstCol, stickyHeader), th/td classes → Th/Td (+sticky on web_name), tokens throughout columns.tsx. Identity column → PlayerCell sm (keeps the hover ⊞ compare button and watchlist star exactly where they are). Badges per policy. The named hazards that MUST be preserved (review checklist): z-tier stack incl. XPtsCell z-50 hover card; dual `sm:hidden`/`hidden sm:table-row` expand rows with visibility-tracking colSpan; row onClick (expand + mobile action sheet) with inner stopPropagation buttons; `getColumnVisibility(horizon, isMobile, preset)` behaviour; custom sortingFns.

## Acceptance (per tab, before moving to the next)

- That tab's feature-inventory section walked and confirmed (interactions, not just render)
- Full vitest green (existing tab tests updated for class changes only — assertions on BEHAVIOUR never weakened); tsc no new errors; e2e 63 green
- `node scripts/contrast-check.mjs` green (incl. new violet pairs)
- Zero `zinc-|gray-|#hex` left in the migrated tab's files (grep gate)

## Out of scope

- Insights, Club Form, Perfect GW, and all This Week non-table tabs (decision/lineup/live/review) → UIX-04
- Any behavioural change, column addition/removal, engine swap
- Tabs primitive changes (SegmentedToggle is separate by design)
