# Phase 115: Team News Wiring (v1.21) - Research

**Researched:** 2026-05-17
**Domain:** React component wiring — staleness suppression guard + inline NewsBanner placement
**Confidence:** HIGH

---

## Summary

Phase 115 is a narrow, surgical UI wiring phase with zero pipeline or data-model changes. All three requirements (NEWS-01, NEWS-02, NEWS-03) operate exclusively on the existing `NewsBanner` component, `CaptainPicksPanel`, and `OpportunityCostTable`. Every data field, prop interface, and type definition needed is already present in production.

NEWS-01 adds a staleness suppression guard inside `NewsBanner`: after `computeNewsSeverity()` computes severity, a new inline helper checks whether a zinc-severity badge is older than 14 days and, if so, returns `null` — mirroring the existing `severity === 'none'` guard pattern directly above it. Red and amber severities are never suppressed regardless of `news_added` age.

NEWS-02 adds a single `<NewsBanner>` import and call-site into `CandidateRow` (inside `CaptainPicksPanel.tsx`), placed after the existing `McLabel` badge inside the `flex flex-wrap` div at line 120. The `candidate` (`MergedPlayer`) already carries all three required props. NEWS-03 requires no code changes at all — `OpportunityCostTable` already passes `news_added` to `NewsBanner`; the staleness guard from NEWS-01 activates automatically.

**Primary recommendation:** Implement NEWS-01 first (staleness guard in `NewsBanner`), then NEWS-02 (import + one JSX element in `CaptainPicksPanel`). NEWS-03 requires only a verification pass. Estimated effort: 2–3 targeted code edits + test coverage additions.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 14-day staleness check lives inside `NewsBanner` — `if (severity === 'zinc' && isStale(news_added)) return null` inserted after `computeNewsSeverity()`. `computeNewsSeverity()` signature stays unchanged.
- **D-02:** Use `Date.now()` directly inside `NewsBanner` — no injectable `now` parameter. Tests use `jest.useFakeTimers()` or `jest.spyOn(Date, 'now')`.
- **D-03:** Threshold is exactly 14 days. Red and amber severity are NEVER suppressed regardless of `news_added` age.
- **D-04:** `NewsBanner` placed inline in the first flex div of `CandidateRow`, appended after McLabel. `flex-wrap` already handles overflow.
- **D-05:** No additional wiring needed in `OpportunityCostTable`. NEWS-03 auto-satisfied by NEWS-01.

### Claude's Discretion

None — all decisions were locked during discuss-phase.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NEWS-01 | `NewsBanner` suppresses zinc-severity badges older than 14 days via `news_added` field | Guard pattern established; insertion point confirmed at line 34–35 of `NewsBanner.tsx`; `news_added` prop already in interface (currently unused) |
| NEWS-02 | User sees `NewsBanner` in `CaptainPicksPanel` candidate rows | `CandidateRow` confirmed at lines 85–163; insertion point after line 131 (McLabel); `candidate.news`, `candidate.news_added`, `candidate.chance_of_playing_next_round` all present on `MergedPlayer` |
| NEWS-03 | User sees `NewsBanner` in `TransferPanel`/`OpportunityCostTable` buy-candidate rows (staleness suppression applies) | `PlayerMoveCell` already passes all three props to `NewsBanner` at lines 137–141; verified — no code change needed |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Staleness suppression logic | Browser / Client (`NewsBanner.tsx`) | — | Pure render-time guard; no server round-trip needed; severity classification already client-side |
| CaptainPicksPanel news display | Browser / Client (`CaptainPicksPanel.tsx`) | — | Additive JSX in an existing client component; data flows from existing `MergedPlayer` |
| OpportunityCostTable news staleness | Browser / Client (`NewsBanner.tsx`) | — | Auto-activated by NEWS-01; `OpportunityCostTable` is already a client component |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (existing) | project-installed | Component rendering | Already in use — no new dependency |
| Vitest + RTL | project-installed | Component testing | Existing test suite; `NewsBanner.test.tsx` already uses RTL + `vi.spyOn` |

No new packages required. [VERIFIED: codebase grep — `src/components/news/NewsBanner.tsx`, `vitest.config.ts`]

### Supporting

None. This phase is purely compositional — no new libraries, no new routes, no new hooks.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Date.now()` direct | Injectable `now` param | D-02 locks `Date.now()` direct; injectable param adds complexity with no benefit since Vitest supports `vi.spyOn(Date, 'now')` |

---

## Architecture Patterns

### System Architecture Diagram

```
FPL API data (news, news_added, chance_of_playing_next_round)
  → MergedPlayer type (src/lib/types.ts lines 26–28)
       |
       ├─→ CaptainPicksPanel.CandidateRow (NEWS-02)
       |      → <NewsBanner news_added={...} .../>
       |                 |
       |                 ↓
       |         computeNewsSeverity()   →  'red' | 'amber' | 'zinc' | 'none'
       |                 |
       |          [NEWS-01 staleness guard]
       |          severity === 'zinc' && isStale(news_added) → return null
       |                 |
       |          render inline badge OR null
       |
       └─→ OpportunityCostTable.PlayerMoveCell (NEWS-03 — no change)
              → <NewsBanner news_added={t.buy.news_added} .../>  (already wired)
                        |
                [NEWS-01 guard activates automatically]
```

### Recommended Project Structure

No structural changes. All work occurs in existing files:

```
src/
├── components/
│   ├── news/
│   │   └── NewsBanner.tsx          # NEWS-01: add staleness guard (3 lines)
│   ├── captaincy/
│   │   └── CaptainPicksPanel.tsx   # NEWS-02: import + 1 JSX element
│   └── transfers/
│       └── OpportunityCostTable.tsx # NEWS-03: read-only verification
└── lib/
    └── newsSeverity.ts             # NO CHANGES — pure classifier untouched
```

### Pattern 1: Staleness Guard in NewsBanner (NEWS-01)

**What:** Inline helper + early-return guard extending the existing `severity === 'none'` pattern.
**When to use:** Any render-time suppression based on data age — mirrors the existing guard structure.

**Current NewsBanner.tsx (lines 31–42):**
```tsx
// Source: src/components/news/NewsBanner.tsx (verified 2026-05-17)
export function NewsBanner({ news, chance_of_playing_next_round }: NewsBannerProps) {
  const enabled = useNewsFlagEnabled()
  if (!enabled || !news || news.trim().length === 0) return null
  const severity = computeNewsSeverity(chance_of_playing_next_round, news)
  if (severity === 'none') return null
  // ... render
}
```

**After NEWS-01 (D-01, D-02, D-03):**
```tsx
// Source: CONTEXT.md §specifics — confirmed pattern
export function NewsBanner({ news, news_added, chance_of_playing_next_round }: NewsBannerProps) {
  const enabled = useNewsFlagEnabled()
  if (!enabled || !news || news.trim().length === 0) return null
  const severity = computeNewsSeverity(chance_of_playing_next_round, news)
  // NEWS-01: suppress stale zinc badges (14-day gate, D-01/D-02/D-03)
  const isStale = (newsAdded?: string): boolean =>
    newsAdded ? Date.now() - new Date(newsAdded).getTime() > 14 * 24 * 60 * 60 * 1000 : false
  if (severity === 'zinc' && isStale(news_added)) return null
  if (severity === 'none') return null
  // ... render unchanged
}
```

**Critical note:** `news_added` is already in `NewsBannerProps` (verified in `src/components/news/NewsBanner.tsx` line 13 and `src/components/news/types.ts` line 6) but the function signature currently destructures only `{ news, chance_of_playing_next_round }`. The signature must be updated to destructure `news_added` as well.

### Pattern 2: CandidateRow NewsBanner Insertion (NEWS-02)

**What:** Import `NewsBanner` and append one JSX element after `McLabel` in the first flex div.
**When to use:** Adding inline news to any flex-wrapped badge row with `MergedPlayer` data.

```tsx
// Source: CONTEXT.md D-04, UI-SPEC §NEWS-02 (verified against CaptainPicksPanel.tsx line 131)

// 1. Add import at top of CaptainPicksPanel.tsx:
import { NewsBanner } from '@/components/news/NewsBanner'

// 2. In CandidateRow, after line 131 {mcLabel && <McLabel .../>}:
{mcLabel && <McLabel label={mcLabel.label} value={mcLabel.value} />}
<NewsBanner
  news={candidate.news ?? ''}
  news_added={candidate.news_added}
  chance_of_playing_next_round={candidate.chance_of_playing_next_round}
/>
```

### Pattern 3: OpportunityCostTable Verification (NEWS-03)

**What:** Read-only verification that `news_added` pass-through activates the staleness guard.
**Current state (verified at lines 137–141):**
```tsx
// Source: src/components/transfers/OpportunityCostTable.tsx lines 136–141
<NewsBanner
  news={t.buy.news ?? ''}
  news_added={t.buy.news_added}
  chance_of_playing_next_round={t.buy.chance_of_playing_next_round}
/>
```
All three props are already passed. Once NEWS-01 lands, the guard activates here automatically. [VERIFIED: codebase read]

### Anti-Patterns to Avoid

- **Modifying `computeNewsSeverity()` signature:** D-01 locks this. The classifier stays date-unaware. Staleness logic belongs only in `NewsBanner`.
- **Adding injectable `now` parameter:** D-02 locks `Date.now()` direct. Test time control via `vi.spyOn(Date, 'now')`.
- **Suppressing red or amber by age:** D-03: only zinc is age-gated. Never add an age check for red/amber.
- **Placing `isStale` check before `computeNewsSeverity()`:** Severity must be known before the staleness check runs (guard: `severity === 'zinc' && isStale(...)`). Wrong order would suppress before severity is classified.
- **Forgetting to destructure `news_added` in the function signature:** The prop exists on the interface but the current function signature does not destructure it. Missing this causes `news_added` to be `undefined` always, making the staleness guard permanently inactive.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date arithmetic for 14-day delta | Custom date library | `Date.now() - new Date(newsAdded).getTime()` | Standard JS Date arithmetic; no library needed for a single millisecond comparison |
| Test time control | Wrapping `Date.now` in a module-level injectable | `vi.spyOn(Date, 'now')` | Vitest built-in; already used pattern in this codebase's test infrastructure |
| News severity classification | Any inline logic | `computeNewsSeverity()` from `newsSeverity.ts` | Already tested, pure function; extending it would break D-01 |

**Key insight:** This phase has no complex custom logic to avoid. The only novel code is a 2-line inline helper + guard.

---

## Common Pitfalls

### Pitfall 1: Forgetting to destructure `news_added` from props

**What goes wrong:** `NewsBanner` receives `news_added` as a prop (it's in `NewsBannerProps`) but the current function signature is `{ news, chance_of_playing_next_round }` — `news_added` is silently dropped. Staleness guard always sees `undefined`, `isStale` always returns `false`, zinc badges are never suppressed.
**Why it happens:** The prop was added to the interface in Phase 88 for future use but was not destructured.
**How to avoid:** When adding the guard, update the destructuring to `{ news, news_added, chance_of_playing_next_round }`.
**Warning signs:** Test for fresh zinc suppression passes but stale zinc suppression test never makes the banner disappear.

### Pitfall 2: Guard order — staleness check before severity classification

**What goes wrong:** If `isStale` is called before `computeNewsSeverity()`, the severity is unknown and the `severity === 'zinc'` predicate cannot be evaluated correctly.
**Why it happens:** Refactoring the guard block without following the logical dependency.
**How to avoid:** Guard order must be: (1) feature flag check, (2) empty news check, (3) `computeNewsSeverity()`, (4) staleness check `if (severity === 'zinc' && isStale(news_added))`, (5) none-severity check.
**Warning signs:** TypeScript error on `severity` reference before assignment.

### Pitfall 3: Applying staleness suppression to red/amber

**What goes wrong:** Extending the age check to all severities (`if (isStale(news_added)) return null`) suppresses red/amber injury news for long-standing injuries — e.g., a player injured for 3 months loses their warning badge.
**Why it happens:** Generalising the guard without reading D-03.
**How to avoid:** The predicate must explicitly gate only zinc: `if (severity === 'zinc' && isStale(news_added))`.
**Warning signs:** Red-severity test cases returning null in test suite.

### Pitfall 4: Missing import in CaptainPicksPanel

**What goes wrong:** `<NewsBanner>` JSX added to `CandidateRow` but `NewsBanner` not imported — TypeScript build error.
**Why it happens:** Adding JSX inline without adding the import statement.
**How to avoid:** Add `import { NewsBanner } from '@/components/news/NewsBanner'` to the import block at the top of `CaptainPicksPanel.tsx`.
**Warning signs:** `Cannot find name 'NewsBanner'` TypeScript error.

### Pitfall 5: `news` prop nullability — passing `undefined` instead of `''`

**What goes wrong:** `candidate.news` is typed as `string` (not `string | undefined`) on `MergedPlayer`, but defensive `?? ''` is still the correct pattern to match the `NewsBanner` prop type (`news: string`). Omitting the fallback causes a type error if the field is ever undefined at runtime.
**Why it happens:** Assuming `MergedPlayer.news: string` means it can never be undefined.
**How to avoid:** Always pass `news={candidate.news ?? ''}` to `NewsBanner`.
**Warning signs:** TypeScript warns about `string | undefined` not assignable to `string`.

---

## Code Examples

### Verified Current State of NewsBanner

```tsx
// Source: src/components/news/NewsBanner.tsx (verified 2026-05-17)
export function NewsBanner({ news, chance_of_playing_next_round }: NewsBannerProps) {
  const enabled = useNewsFlagEnabled()
  if (!enabled || !news || news.trim().length === 0) return null
  const severity = computeNewsSeverity(chance_of_playing_next_round, news)
  if (severity === 'none') return null
  return (
    <div className={`text-xs ${SEVERITY_CLASS[severity]}`} data-testid="news-banner">
      <span aria-hidden="true">{SEVERITY_ICON[severity]} </span>
      {news}
    </div>
  )
}
```

### Verified OpportunityCostTable NewsBanner call site

```tsx
// Source: src/components/transfers/OpportunityCostTable.tsx lines 136–141 (verified 2026-05-17)
<NewsBanner
  news={t.buy.news ?? ''}
  news_added={t.buy.news_added}
  chance_of_playing_next_round={t.buy.chance_of_playing_next_round}
/>
```

### MergedPlayer news fields

```typescript
// Source: src/lib/types.ts lines 26–28 (verified 2026-05-17)
news: string                              // injury/availability news text
news_added?: string                       // ISO timestamp when news was set
chance_of_playing_next_round?: number | null  // 25/50/75/100 or null
```

### CandidateRow first flex div — insertion point

```tsx
// Source: src/components/captaincy/CaptainPicksPanel.tsx lines 120–132 (verified 2026-05-17)
<div className="flex items-center gap-1.5 sm:flex-1 flex-wrap">
  <span className="text-sm text-zinc-400 w-4 shrink-0">{rank}</span>
  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{candidate.web_name}</span>
  <span className="text-sm text-zinc-500 dark:text-zinc-400" title={EO_TOOLTIP} data-testid="eo-percent">
    ~{eoPercent}%
  </span>
  {showDangerBadge && <DangerousToFadeBadge />}
  {mcLabel && <McLabel label={mcLabel.label} value={mcLabel.value} />}
  {/* NEWS-02: NewsBanner goes here */}
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `news_added` declared but ignored | `news_added` activates staleness gate | Phase 115 NEWS-01 | Zinc badges older than 14 days suppress; no badge fatigue on decision surfaces |
| No news in `CaptainPicksPanel` | Inline `NewsBanner` in each `CandidateRow` | Phase 115 NEWS-02 | Captain candidates show real-time availability context |

**No deprecated approaches in this phase.** All patterns follow the established Phase 88 / Phase 93 component wiring conventions.

---

## Runtime State Inventory

Step 2.5 SKIPPED — this is a greenfield UI wiring phase (no rename, refactor, or migration). No stored data, live service config, OS-registered state, secrets, or build artifacts are affected.

---

## Environment Availability

Step 2.6 SKIPPED — no external dependencies beyond the project's own codebase. All libraries and tools already present.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vitest | Test suite | ✓ | see `vitest.config.ts` | — |
| @testing-library/react | `NewsBanner.test.tsx` | ✓ | project-installed | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/components/news/NewsBanner.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NEWS-01 | Zinc badge suppressed when `news_added` > 14 days old | unit | `npx vitest run src/components/news/NewsBanner.test.tsx` | ✅ (existing file — new test cases needed) |
| NEWS-01 | Zinc badge shown when `news_added` < 14 days old | unit | `npx vitest run src/components/news/NewsBanner.test.tsx` | ✅ (new test case needed) |
| NEWS-01 | Red badge NOT suppressed when `news_added` > 14 days | unit | `npx vitest run src/components/news/NewsBanner.test.tsx` | ✅ (new test case needed) |
| NEWS-01 | Amber badge NOT suppressed when `news_added` > 14 days | unit | `npx vitest run src/components/news/NewsBanner.test.tsx` | ✅ (new test case needed) |
| NEWS-01 | Missing `news_added` → isStale returns false (no suppression) | unit | `npx vitest run src/components/news/NewsBanner.test.tsx` | ✅ (new test case needed) |
| NEWS-02 | `NewsBanner` renders in `CandidateRow` for fresh zinc news | unit/integration | `npx vitest run` (captain-picks tests) | ❌ Wave 0 — new test needed |
| NEWS-02 | `CandidateRow` row unchanged when news empty/suppressed | unit/integration | `npx vitest run` (captain-picks tests) | ❌ Wave 0 — new test needed |
| NEWS-03 | Verification only — stale zinc suppression in `PlayerMoveCell` | manual | Visual inspection with stale zinc fixture | N/A |

### Test Time Control Pattern (D-02)

```typescript
// Source: Vitest docs — vi.spyOn as Date.now override
// Use this pattern for staleness tests:
import { vi } from 'vitest'

// Simulate a date 15 days after news_added
const staleDate = new Date('2026-01-01T00:00:00Z')
const newsAddedIso = '2025-12-17T00:00:00Z'  // 15 days before staleDate
vi.spyOn(Date, 'now').mockReturnValue(staleDate.getTime())
// render <NewsBanner news="Info" news_added={newsAddedIso} chance_of_playing_next_round={100} />
// expect container.querySelector('[data-testid="news-banner"]').toBeNull()
```

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/news/NewsBanner.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] New staleness test cases in `src/components/news/NewsBanner.test.tsx` — covers NEWS-01 (5 new cases)
- [ ] New integration test for `CandidateRow` + `NewsBanner` — covers NEWS-02

*(The existing `NewsBanner.test.tsx` file and `newsSeverity.test.ts` cover all pre-existing behaviour; only new cases are needed.)*

---

## Security Domain

All changes are pure rendering logic on data already fetched and processed by the existing pipeline. No authentication, no new routes, no new data inputs, no user-supplied content processed.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | `news` text is FPL API data, not user input; already displayed in existing `NewsBanner` without escaping concern |
| V6 Cryptography | no | — |

No new threat patterns introduced. [VERIFIED: phase scope review — no new API calls, no new user inputs, no new data surfaces]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**This table is empty.** All claims in this research were verified by direct codebase inspection. No assumed knowledge was used for any decision-relevant claim.

---

## Open Questions

None. The phase is fully specified with locked decisions and all code has been read and verified.

---

## Sources

### Primary (HIGH confidence)

- `src/components/news/NewsBanner.tsx` — component to modify (lines 31–42 verified)
- `src/lib/newsSeverity.ts` — pure classifier (lines 1–32 verified, signature confirmed unchanged)
- `src/components/captaincy/CaptainPicksPanel.tsx` — `CandidateRow` insertion point (lines 85–163 verified)
- `src/components/transfers/OpportunityCostTable.tsx` — `PlayerMoveCell` existing wiring (lines 115–167 verified)
- `src/lib/types.ts` — `MergedPlayer` type (lines 23–28 verified)
- `src/components/news/types.ts` — `NewsBannerProps` interface (verified — `news_added?: string` present)
- `src/components/news/NewsBanner.test.tsx` — existing test file and patterns (verified)
- `.planning/phases/115-team-news-wiring-v1-21/115-CONTEXT.md` — locked decisions D-01 through D-05
- `.planning/phases/115-team-news-wiring-v1-21/115-UI-SPEC.md` — visual contract (verified)
- `.planning/REQUIREMENTS.md` — NEWS-01, NEWS-02, NEWS-03 definitions (verified)
- `vitest.config.ts` — test framework configuration (verified)
- `.planning/config.json` — `nyquist_validation: true` (verified)

### Secondary (MEDIUM confidence)

None needed — all claims verified from primary codebase sources.

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all files read directly from codebase
- Architecture: HIGH — insertion points confirmed by line-by-line read of all three files
- Pitfalls: HIGH — derived from the actual current code state (e.g., destructuring omission verified)
- Test strategy: HIGH — existing Vitest + RTL infrastructure confirmed present

**Research date:** 2026-05-17
**Valid until:** Stable — no external dependencies; valid until any of the three source files are modified
