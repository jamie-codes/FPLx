# Phase 8: Minutes Risk UI + Transfer Integration - Research

**Researched:** 2026-03-30
**Domain:** React/TypeScript UI — badge component, TanStack Table column addition, pure-function sort modifier in transfer engine
**Confidence:** HIGH

---

## Summary

Phase 8 is a narrow, well-bounded UI + logic phase. All the data it needs (`mins_risk`, `start_prob`, `xmins`) already exists on every `MergedPlayer` — Phase 7 added these fields to the TypeScript types and the Python pipeline writes them unconditionally. No new API routes, no new data fetches, and no schema changes are required. The work is three discrete sub-tasks:

1. Create `MinsRiskBadge.tsx` — a pure display component that maps a `MinsRisk` value to a colour-coded span.
2. Add a non-sortable "Risk" column to both `SquadView.tsx` (manual table) and `GemTable` (`columns.tsx` via `col.display()`).
3. Modify `transfer-engine.ts` to apply a `mins_risk` penalty to the final sort so rotation-risk and cameo candidates rank lower than equivalent-gem-score non-risk players.

The UI-SPEC is already approved and is prescriptive: exact class names, copy, tooltip text, column order, and the `injured` suppression rule are all locked. The planner must follow the UI-SPEC verbatim.

**Primary recommendation:** Build in three plans — (1) MinsRiskBadge component + SquadView column, (2) GemTable column, (3) transfer-engine penalty + tests. The badge is a prerequisite for both table changes so it must land first.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MINS-02 | User can see rotation risk badge per player (Nailed / Likely start / Rotation risk / Cameo risk) in SquadView and GemTable | `mins_risk: MinsRisk` already typed on `ScoredPlayer` (extends `MergedPlayer`). Badge component is new; column additions are additive to existing tables. |
| MINS-03 | Transfer suggestions de-prioritise rotation risk players relative to gem score | `computeTransferSuggestions` in `transfer-engine.ts` is a pure function — sort comparator can be extended. `mins_risk` is available on `ScoredPlayer`. No API change. |
</phase_requirements>

---

## Standard Stack

### Core (all already in use — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | Component rendering | Project standard |
| TypeScript | ^5 | Type safety | Project standard |
| Tailwind CSS v4 | ^4 | Utility classes | Project standard — no shadcn, no component lib |
| @tanstack/react-table | ^8.21.3 | GemTable column model | Already powering GemTable |
| Vitest | ^4.1.2 | Unit tests | Already configured at root `vitest.config.ts` |

No new packages. No `npm install` step needed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind inline classes | CSS modules / styled-components | Contradicts project pattern — all existing components use Tailwind directly |
| col.display() for Risk column | col.accessor('mins_risk') | accessor would coerce MinsRisk to string cell; display gives full JSX control — matches how Trend and Next 5 columns are built |

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
src/
├── components/
│   └── shared/
│       └── MinsRiskBadge.tsx    ← NEW: shared badge, consumed by both SquadView and GemTable
│   ├── squad/
│   │   └── SquadView.tsx         ← MODIFIED: add Risk column
│   └── gem-table/
│       └── columns.tsx           ← MODIFIED: add Risk col.display() entry
├── lib/
│   └── transfer-engine.ts        ← MODIFIED: rotation risk penalty in sort comparator
tests/
└── lib/
    └── transfer-engine.test.ts   ← MODIFIED: add MINS-03 tests
```

There is no existing `src/components/shared/` directory. It must be created. This is the correct location — the badge is consumed by both `SquadView` (under `squad/`) and `columns.tsx` (under `gem-table/`), so neither subdirectory is the right home.

### Pattern 1: MinsRiskBadge component

**What:** Pure display component. Accepts `{ minsRisk: MinsRisk }`, returns a `<span>` or `null`.

**When to use:** Anywhere `mins_risk` needs visual representation. Phase 8 uses it in SquadView, GemTable columns, and inline in TransferPanel suggestion rows.

**Key rule from UI-SPEC:** When `minsRisk === 'injured'`, render `null`. The existing `StatusBadge` dot already communicates this — a second badge would duplicate the signal.

**Rendering contract (from approved UI-SPEC — do not deviate):**

```typescript
// Source: 08-UI-SPEC.md — Component Inventory
// File: src/components/shared/MinsRiskBadge.tsx
import type { MinsRisk } from '@/lib/types'

const BADGE_MAP: Record<Exclude<MinsRisk, 'injured'>, { bg: string; text: string; label: string; title: string }> = {
  nailed:        { bg: 'bg-green-100', text: 'text-green-800', label: 'Nailed',        title: 'Nailed: high start probability (≥85%)' },
  likely_start:  { bg: 'bg-blue-100',  text: 'text-blue-800',  label: 'Likely start',  title: 'Likely start: moderate start probability (65–84%)' },
  rotation_risk: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Rotation risk', title: 'Rotation risk: rotation risk identified' },
  cameo:         { bg: 'bg-zinc-100',  text: 'text-zinc-600',  label: 'Cameo',          title: 'Cameo: low minutes expected' },
}

export function MinsRiskBadge({ minsRisk }: { minsRisk: MinsRisk }) {
  if (minsRisk === 'injured') return null
  const { bg, text, label, title } = BADGE_MAP[minsRisk]
  return (
    <span
      className={`inline-block text-xs font-normal ${text} ${bg} rounded px-2 py-1`}
      title={title}
    >
      {label}
    </span>
  )
}
```

**Defensive handling:** UI-SPEC also states render `null` if `mins_risk` field is missing. TypeScript prevents this for `ScoredPlayer` at compile time, but the component should handle it at runtime if reused outside typed contexts.

### Pattern 2: SquadView Risk column

**What:** Additive `<th>` header + `<td>` cell appended after the existing "Status" column.

**Key detail:** SquadView is a hand-rolled table (not TanStack). The column is added by editing the `<thead>` `<tr>` and the `<tbody>` row render directly.

**Column order after change (from UI-SPEC):**
```
Player | Team | Price | Own% | Mins | Gem | Status | Risk
```

**Cell pattern:**
```tsx
<td className="px-3 py-2 whitespace-nowrap">
  <MinsRiskBadge minsRisk={player.mins_risk} />
</td>
```

**Bench opacity:** `isBench` applies `opacity-50` to the whole row already — no special handling needed for the badge. Confirmed in UI-SPEC.

### Pattern 3: GemTable Risk column (col.display)

**What:** New `col.display()` entry in `src/components/gem-table/columns.tsx`. This matches the existing `trend` and `fixtures` column patterns.

**Positioning:** Insert between the existing `status` accessor and the `trend` display column. Column order after change:
```
... | Status | Risk | Trend | Next 5
```

**From UI-SPEC:**
```typescript
// Source: 08-UI-SPEC.md — Component Inventory
col.display({
  id: 'mins_risk',
  header: 'Risk',
  enableSorting: false,
  cell: ({ row }) => <MinsRiskBadge minsRisk={row.original.mins_risk} />,
})
```

Header styles: `font-semibold text-gray-700` — matching existing GemTable `<th>` pattern.
Cell padding: `px-2 py-1 whitespace-nowrap` — matching existing GemTable `<td>` pattern (already rendered by the GemTable loop, not in the column def).

### Pattern 4: Transfer engine rotation risk penalty (MINS-03)

**What:** Sort modifier in `computeTransferSuggestions`. The current Step 5 sort has two tiers: `budget_sufficient` (primary), then `gem_delta` (secondary). Phase 8 adds a third dimension: rotation risk.

**Decision context from STATE.md / ROADMAP.md:**
- "rotation risk classification gated on status == 'a' with blank news — injury-period minutes excluded from classification window"
- `mins_risk` values of `rotation_risk` and `cameo` should rank lower than non-risk players at equivalent gem score

**Penalty design:** Add a boolean helper `isRotationRisk(player: ScoredPlayer): boolean` that returns `true` when `player.mins_risk === 'rotation_risk' || player.mins_risk === 'cameo'`. In the sort comparator, after budget tier, check rotation risk tier before gem_delta.

**Updated sort order (3 tiers):**
1. `budget_sufficient` — affordable before unaffordable (unchanged)
2. rotation risk on the **sell** side — non-risk sell candidates ranked higher (they are worse squad members needing replacement; having a rotation risk player to sell is good)
3. `gem_delta` — higher delta first within tier

**Clarification on which side the penalty applies:** The UI-SPEC says "rotation-risk and cameo players are de-prioritised relative to equivalent gem-score players without rotation risk". The question is: does the penalty apply to the **buy** side or the **sell** side?

Reading the success criterion: "Transfer suggestions rank rotation-risk candidates lower than equivalent gem-score players without rotation risk." The word "candidates" in context means players being considered as sell candidates (candidates for transfer out). A rotation-risk player you own is a prime sell candidate — the engine should surface them near the top as potential sells, not push them down. The "de-prioritise" language in the UI-SPEC under transfer-engine refers to **buy** candidates: a rotation-risk player as a potential buy is less desirable than a non-risk player with the same gem_score.

**Corrected interpretation:** Apply penalty to the **buy** player. When `buy.mins_risk === 'rotation_risk' || 'cameo'`, rank that suggestion lower than a suggestion where `buy.mins_risk` is `nailed` or `likely_start` at same gem_delta and budget tier.

**Updated sort comparator (3 tiers):**
```typescript
// Source: transfer-engine.ts pattern extension
function isRotationRisk(p: ScoredPlayer): boolean {
  return p.mins_risk === 'rotation_risk' || p.mins_risk === 'cameo'
}

allSuggestions.sort((a, b) => {
  // Tier 1: affordable before unaffordable
  if (a.budget_sufficient !== b.budget_sufficient) {
    return a.budget_sufficient ? -1 : 1
  }
  // Tier 2: non-rotation-risk buy before rotation-risk buy
  const aRisk = isRotationRisk(a.buy)
  const bRisk = isRotationRisk(b.buy)
  if (aRisk !== bRisk) return aRisk ? 1 : -1
  // Tier 3: higher gem_delta first
  return b.gem_delta - a.gem_delta
})
```

### Pattern 5: MinsRiskBadge in TransferPanel sell row

**What:** Per UI-SPEC, add `<MinsRiskBadge minsRisk={s.sell.mins_risk} />` inline after the sell player name in each suggestion row. This is a visual confirmation that the rotation penalty was applied.

**Location in TransferPanel.tsx:** After `<span className="font-medium">{s.sell.web_name}</span>`, before the gem score span.

This applies to both the main suggestions list and the 2-transfer combo section (they share the same row template pattern).

### Anti-Patterns to Avoid

- **Rendering a MinsRisk badge for `injured` players:** The UI-SPEC explicitly mandates `null`. The StatusBadge dot already communicates injury. Rendering both duplicates the signal.
- **Making the Risk column sortable:** `mins_risk` is a categorical string, not a numeric rank. Sorting alphabetically would be meaningless. UI-SPEC says `enableSorting: false`.
- **Modifying gem_score to embed rotation risk:** The penalty belongs in the transfer engine sort comparator, not in the gem composite. The gem_score dimension for minutes reliability already factors in minutes played; xmins de-prioritisation is a separate signal layer on top.
- **Applying the rotation risk penalty to the sell side:** The penalty demotes rotation-risk players as buy targets. Owning a rotation-risk player is a reason to sell — that signal is already carried by their lower gem_score (via minutes_score dimension).
- **Using col.accessor('mins_risk') instead of col.display():** The accessor form would call `.toString()` on the MinsRisk value. The display form gives full JSX control, matching the Trend and Next 5 column pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip on badge | Custom tooltip JS/state | Native HTML `title` attribute | UI-SPEC mandates `title` attribute — no JS tooltip library |
| Column visibility toggle for Risk | New toggle UI | None — column is always visible | No requirement for column hiding in Phase 8 |

**Key insight:** This phase is almost entirely additive UI on top of data that already exists. The only logic change is a comparator extension in a pure function.

---

## Common Pitfalls

### Pitfall 1: Forgetting to add MinsRiskBadge to TransferPanel sell rows

**What goes wrong:** MINS-02 passes (badge in SquadView + GemTable), but the UI-SPEC also requires the badge inline on sell-side rows in TransferPanel. Easy to miss because it's buried in the component inventory notes, not a top-level requirement.
**Why it happens:** TransferPanel has two badge placement sites: the main suggestions list AND the 2-transfer combo section. Both must be updated.
**How to avoid:** Treat TransferPanel as a third placement site, not just a side note.
**Warning signs:** Visual review shows badges in GemTable and SquadView but not in Transfer suggestions sell rows.

### Pitfall 2: `injured` status renders a badge

**What goes wrong:** Mapping `injured` to a zinc or red badge instead of returning `null`.
**Why it happens:** It seems natural to show a badge for every status. But the existing `StatusBadge` dot in both SquadView and GemTable already communicates injury/availability.
**How to avoid:** The `BADGE_MAP` approach (mapping only the 4 non-injured values) naturally enforces `null` return for `injured`.
**Warning signs:** Player rows for injured players show both a red dot AND a badge.

### Pitfall 3: Applying rotation risk penalty to sell candidates, not buy candidates

**What goes wrong:** Rotation-risk players you already own get pushed to the bottom of the sell list, hiding the most urgent transfer-out candidates.
**Why it happens:** The requirement says "de-prioritise rotation risks" which can be read as either side.
**How to avoid:** Re-read the success criterion: "rank rotation-risk candidates lower than equivalent gem-score players without rotation risk." In FPL transfer context, "candidate" = player you are considering buying. Penalty applies to the buy side.
**Warning signs:** In test scenarios, a rotation-risk squad player with low gem_score does not appear as the top sell suggestion.

### Pitfall 4: Regression in transfer sort order

**What goes wrong:** Adding the rotation risk tier breaks the existing `budget_sufficient` primary sort.
**Why it happens:** The comparator is extended incorrectly — e.g., rotation check runs before budget check.
**How to avoid:** Keep budget tier as Tier 1. Rotation risk tier is Tier 2. gem_delta is Tier 3.
**Warning signs:** Existing transfer-engine tests fail — specifically the "unaffordable suggestions are sorted below affordable ones" test in `tests/lib/transfer-engine.test.ts`.

### Pitfall 5: `src/components/shared/` directory does not exist

**What goes wrong:** TypeScript import of `MinsRiskBadge` from `@/components/shared/MinsRiskBadge` fails because the directory hasn't been created.
**Why it happens:** No existing component uses a `shared/` directory — it must be created as part of Plan 1.
**How to avoid:** `mkdir src/components/shared/` before writing the component file.
**Warning signs:** `tsc --noEmit` fails with "Cannot find module '@/components/shared/MinsRiskBadge'".

### Pitfall 6: GemTable Risk column position

**What goes wrong:** Risk column appended after "Next 5" instead of between "Status" and "Trend".
**Why it happens:** The `columns` array in `columns.tsx` ends with the `trend` and `fixtures` display columns. Inserting in the middle requires careful array positioning.
**How to avoid:** Insert the `mins_risk` display column definition between the `status` accessor and the `trend` display column in the `columns` array.
**Warning signs:** Visual review shows the Risk column as the last column in GemTable instead of adjacent to Status.

---

## Code Examples

### MinsRiskBadge — full component

```typescript
// File: src/components/shared/MinsRiskBadge.tsx
// Source: 08-UI-SPEC.md component inventory + existing badge pattern from TransferPanel.tsx
import type { MinsRisk } from '@/lib/types'

interface Config {
  bg: string
  text: string
  label: string
  title: string
}

const BADGE_MAP: Record<Exclude<MinsRisk, 'injured'>, Config> = {
  nailed: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Nailed',
    title: 'Nailed: high start probability (≥85%)',
  },
  likely_start: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'Likely start',
    title: 'Likely start: moderate start probability (65–84%)',
  },
  rotation_risk: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    label: 'Rotation risk',
    title: 'Rotation risk: rotation risk identified',
  },
  cameo: {
    bg: 'bg-zinc-100',
    text: 'text-zinc-600',
    label: 'Cameo',
    title: 'Cameo: low minutes expected',
  },
}

export function MinsRiskBadge({ minsRisk }: { minsRisk: MinsRisk }) {
  if (!minsRisk || minsRisk === 'injured') return null
  const config = BADGE_MAP[minsRisk]
  if (!config) return null
  return (
    <span
      className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`}
      title={config.title}
    >
      {config.label}
    </span>
  )
}
```

### Transfer engine sort with rotation risk penalty

```typescript
// Extend the sort in computeTransferSuggestions Step 5
// Source: transfer-engine.ts pattern + MINS-03 requirement

function isRotationRisk(p: ScoredPlayer): boolean {
  return p.mins_risk === 'rotation_risk' || p.mins_risk === 'cameo'
}

allSuggestions.sort((a, b) => {
  // Tier 1: affordable before unaffordable (unchanged)
  if (a.budget_sufficient !== b.budget_sufficient) {
    return a.budget_sufficient ? -1 : 1
  }
  // Tier 2: non-rotation-risk buy ranked higher than rotation-risk buy
  const aRisk = isRotationRisk(a.buy)
  const bRisk = isRotationRisk(b.buy)
  if (aRisk !== bRisk) return aRisk ? 1 : -1
  // Tier 3: higher gem_delta first
  return b.gem_delta - a.gem_delta
})
```

### GemTable column insertion point

```typescript
// Insert between status accessor and trend display column in columns.tsx
// Source: columns.tsx current structure + 08-UI-SPEC.md
col.accessor('status', {
  header: 'Status',
  enableSorting: false,
  cell: (info) => info.getValue() === 'a' ? '' : info.getValue().toUpperCase(),
}),
// ← INSERT HERE:
col.display({
  id: 'mins_risk',
  header: 'Risk',
  enableSorting: false,
  cell: ({ row }) => <MinsRiskBadge minsRisk={row.original.mins_risk} />,
}),
col.display({
  id: 'trend',
  // ... existing trend column unchanged
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 8 is purely TypeScript/React code changes with no external runtime dependencies. All tools (Node, npm, vitest, tsc) confirmed available from Phase 7 execution.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/lib/transfer-engine.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MINS-02 | MinsRiskBadge renders correct class/label for each MinsRisk value | unit | `npx vitest run tests/lib/mins-risk-badge.test.ts` | ❌ Wave 0 |
| MINS-02 | MinsRiskBadge returns null for `injured` | unit | `npx vitest run tests/lib/mins-risk-badge.test.ts` | ❌ Wave 0 |
| MINS-03 | Non-rotation-risk buy ranked above rotation-risk buy at same gem_delta and budget | unit | `npx vitest run tests/lib/transfer-engine.test.ts` | ✅ (extend existing) |
| MINS-03 | Rotation-risk penalty does not break budget_sufficient primary sort | unit | `npx vitest run tests/lib/transfer-engine.test.ts` | ✅ (extend existing) |
| MINS-03 | `cameo` buy ranked lower than non-risk buy at same gem_delta | unit | `npx vitest run tests/lib/transfer-engine.test.ts` | ✅ (extend existing) |

Note: MinsRiskBadge is a React component. The project Vitest config uses `environment: 'node'` — no jsdom. Component render tests would require jsdom setup or React Testing Library. Recommend pure logic tests for the badge map lookup (extract a helper function) and rely on TypeScript compilation + manual visual review for DOM output. This matches the project pattern — existing component files have no unit tests; only pure logic functions are tested.

### Sampling Rate

- **Per task commit:** `npx vitest run tests/lib/transfer-engine.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** `npx tsc --noEmit && npx vitest run` green before verify

### Wave 0 Gaps

- [ ] `tests/lib/mins-risk-badge.test.ts` — covers MINS-02 badge map logic (pure function test, no DOM)

The badge map logic should be extracted as an exportable helper function from `MinsRiskBadge.tsx` to make it testable without jsdom:

```typescript
// Exported from MinsRiskBadge.tsx — testable without DOM
export function getMinsRiskConfig(minsRisk: MinsRisk): Config | null {
  if (!minsRisk || minsRisk === 'injured') return null
  return BADGE_MAP[minsRisk] ?? null
}
```

This makes MINS-02 unit tests straightforward without React Testing Library.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md references `AGENTS.md`. The single directive is:

> This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Implication for Phase 8:** Phase 8 does not add any Next.js API routes, server components, or new routing patterns. All work is in `src/components/` and `src/lib/`. The Next.js API surface is not touched. This constraint is satisfied by default — no new Next.js features are introduced.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `minutes_score` dimension in gem_score as sole minutes signal | `mins_risk` as separate categorical field from xmins.py pipeline | Phase 7 | Enables discrete badge classification without re-normalising gem_score |
| No rotation risk in transfer suggestions | Rotation risk penalty as Tier 2 in sort comparator | Phase 8 | Buy candidates that are rotation risks rank below equivalent non-risk players |

---

## Open Questions

1. **Should the rotation risk tier also affect the 2-transfer combo selection?**
   - What we know: The `two_transfer_combo` is derived from the sorted `allSuggestions` array (takes `allSuggestions[0]` and finds a compatible second). Since rotation risk now affects the main sort, the combo will naturally reflect the penalty.
   - What's unclear: No explicit requirement to override the combo selection logic.
   - Recommendation: No special handling needed. The combo derives from the already-sorted suggestions list, so the penalty propagates automatically.

2. **Does `MinsRiskBadge` need to appear in the 2-transfer combo section of TransferPanel?**
   - What we know: The UI-SPEC says "Add `<MinsRiskBadge />` inline after the player name in the 'Sell' entry of each suggestion row in TransferPanel.tsx." The 2-transfer combo section uses the same row template pattern.
   - Recommendation: Apply consistently to both sections. The badge confirms the penalty was applied, and the combo section shows sell candidates too.

---

## Sources

### Primary (HIGH confidence)

- `src/lib/types.ts` — MinsRisk type definition, MergedPlayer interface with all 6 Phase 7 fields
- `src/lib/transfer-engine.ts` — current sort logic, SingleTransfer interface
- `src/components/squad/SquadView.tsx` — hand-rolled table structure, StatusBadge pattern
- `src/components/gem-table/columns.tsx` — col.display() pattern for Trend and Next 5 columns
- `src/components/transfers/TransferPanel.tsx` — existing badge classes (`bg-green-100 text-green-700`, `bg-red-100 text-red-700`) confirming semantic color pattern
- `.planning/phases/08-minutes-risk-ui-transfer-integration/08-UI-SPEC.md` — approved design contract
- `tests/lib/transfer-engine.test.ts` — existing test patterns, makeScoredPlayer factory with mins_risk field
- `vitest.config.ts` — environment: 'node', @/ alias, .claude exclusion

### Secondary (MEDIUM confidence)

- `STATE.md` decisions section — confirmed "rotation risk gated on status='a' + blank news", "injured" suppression rule
- `.planning/phases/07-pipeline-schema-extension/07-03-SUMMARY.md` — confirmed all 6 fields non-nullable, full test suite 90 passed/8 skipped

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, versions locked in package.json
- Architecture: HIGH — all patterns verified from existing source files
- Transfer engine penalty design: HIGH — pure function, comparator extension is mechanically straightforward
- Pitfalls: HIGH — derived from reading the actual source code and UI-SPEC, not from general knowledge
- Test gaps: HIGH — project test pattern (no jsdom, pure logic only) verified from vitest.config.ts

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable codebase, no third-party version concerns)
