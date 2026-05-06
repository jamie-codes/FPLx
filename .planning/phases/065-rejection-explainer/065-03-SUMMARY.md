---
phase: 65
plan: 03
subsystem: components
tags: [rejection-explainer, components, jsx, rtl-green, why-02, why-03]
dependency_graph:
  requires:
    - 065-01 (RED test stubs for ExplainPanel.test.tsx and HighOwnershipCallout.test.tsx)
  provides:
    - src/components/squad/ExplainPanel.tsx (with rejectionReasons?: string[] prop and rejection section)
    - src/components/transfers/HighOwnershipCallout.tsx (WHY-02 display component)
  affects:
    - src/components/squad/SquadView.tsx (Plan 04 threads rejectionReasons here)
    - src/components/transfers/TransferPanel.tsx (Plan 05 derives highOwnershipAbsent entries here)
tech_stack:
  added: []
  patterns:
    - early-return-null pattern (FragilityNote analog) for display-only components
    - optional prop + conditional render pattern (ExplainPanel shortlist analog)
    - HTML entities for emoji rendering (&#8505;&#65039; for ℹ️)
key_files:
  created:
    - src/components/transfers/HighOwnershipCallout.tsx
  modified:
    - src/components/squad/ExplainPanel.tsx
decisions:
  - "ExplainPanel rejectionReasons section uses space-y-1 wrapper and space-y-0.5 ul — explicit exception matching existing positive reasons list"
  - "HighOwnershipCallout uses &#8505;&#65039; HTML entities (not raw emoji) for cross-platform ℹ️ rendering (plan inviolate rule)"
  - "HighOwnershipEntry interface exported from HighOwnershipCallout.tsx so Plan 05 TransferPanel can import the type"
  - "em-dash U+2014 used in both copy variants per plan requirement — assertions in RTL tests confirm presence"
metrics:
  duration: 2m
  completed: 2026-05-06
---

# Phase 65 Plan 03: Rejection Explainer Wave 1 Components Summary

**One-liner:** ExplainPanel extended with rejectionReasons? prop + WHY-03 rejection section, and new HighOwnershipCallout display component for WHY-02 callout — both turning Plan 01 RED tests GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add rejectionReasons prop + section to ExplainPanel.tsx | d5894d4 | src/components/squad/ExplainPanel.tsx |
| 2 | Create HighOwnershipCallout component | ec3dc0c | src/components/transfers/HighOwnershipCallout.tsx |

## ExplainPanel Diff (Task 1)

Only additive changes — existing positive reasons and shortlist sections are unchanged:

```diff
 interface ExplainPanelProps {
   reasons: string[]
   shortlist: ShortlistEntry[] | null
+  rejectionReasons?: string[]   // Phase 65 WHY-03 (D-08)
 }

-export function ExplainPanel({ reasons, shortlist }: ExplainPanelProps) {
+export function ExplainPanel({ reasons, shortlist, rejectionReasons }: ExplainPanelProps) {
   return (
     <div className="bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-100 dark:border-zinc-700 px-3 py-2 space-y-2">
       {/* Reasons section */}
       <ul className="space-y-0.5"> ... </ul>

+      {/* Phase 65 WHY-03: rejection reasons section — between positive reasons and shortlist (D-08). */}
+      {rejectionReasons && rejectionReasons.length > 0 && (
+        <div className="space-y-1">
+          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Why not recommended:</p>
+          <ul className="space-y-0.5">
+            {rejectionReasons.map((reason, i) => (
+              <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400">
+                {reason}
+              </li>
+            ))}
+          </ul>
+        </div>
+      )}

       {/* Shortlist section — only for Sell-verdicted players */}
       {shortlist !== null && shortlist.length > 0 && ( ... )}
     </div>
   )
 }
```

## HighOwnershipCallout Full File Content (Task 2)

Canonical reference for Plans 04/05 integration:

- File: `src/components/transfers/HighOwnershipCallout.tsx` (55 lines)
- `'use client'` directive at top
- Exports: `HighOwnershipCallout` function, `HighOwnershipEntry` interface
- Early-return-null when `entries.length === 0` (D-11)
- Root `<div data-testid="high-ownership-callout">` with `rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 space-y-1`
- Header `&#8505;&#65039; Why aren't these players appearing?` (D-14)
- In-squad copy: `Already ranked #N at POS in your squad by xPts — no upgrade needed` (D-12)
- Not-in-squad copy: `xPts gain vs your POS options is negative — not worth transferring in` (D-12)
- Ownership display: `Math.round(parseFloat(entry.player.selected_by_percent))` — string guard

## Test Run Output

### Both contract files (final run):
```
 Test Files  2 passed (2)
      Tests  14 passed (14)
   Start at  14:49:02
   Duration  618ms
```

### ExplainPanel.test.tsx (7 tests):
- renders positive reasons list always: PASS
- does NOT render rejection section when rejectionReasons prop is undefined (backward compat): PASS
- does NOT render rejection section when rejectionReasons is empty array: PASS
- renders rejection section with header "Why not recommended:" when rejectionReasons is non-empty: PASS
- renders one <li> per rejection reason with text-xs text-zinc-600 dark:text-zinc-400 styling: PASS
- renders rejection section AFTER positive reasons in DOM order (D-08): PASS
- renders rejection section BEFORE replacement shortlist in DOM order (D-08): PASS

### HighOwnershipCallout.test.tsx (7 tests):
- renders nothing when entries is empty array: PASS
- renders root div with data-testid="high-ownership-callout" when entries provided: PASS
- renders header reading "ℹ️ Why aren't these players appearing?": PASS
- renders in-squad variant copy correctly: PASS
- renders not-in-squad variant copy correctly: PASS
- renders ownership percentage as integer via Math.round(parseFloat(selected_by_percent)): PASS
- renders all entries provided (caller controls cap-at-3): PASS

### Adjacent regression scan (src/components/squad/ + src/components/transfers/):
```
 Test Files  5 passed (5)
      Tests  35 passed (35)
   Duration  828ms
```

## Type Check Output

`npx tsc --noEmit` reports 4 pre-existing errors in `src/lib/__tests__/rejection.test.ts` — all
reference `computeRejection`, `REJECTION_START_PROB_THRESHOLD`, `REJECTION_OWNERSHIP_THRESHOLD`,
and `RejectionResult` which Plan 02 (running in parallel in the same wave) adds to `explain.ts`.
These errors were present before Plan 03 execution and are Plan 02's responsibility to resolve.
No new type errors introduced by this plan.

## SquadView.tsx Type Check Confirmation

`ExplainPanel`'s new `rejectionReasons?: string[]` prop is optional — all existing call sites
(SquadView.tsx line ~229) continue to type-check without modification. The optional prop pattern
is additive and backward-compatible.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both components are complete rendering implementations. HighOwnershipCallout renders all
entries passed to it; the entry derivation (cap at 3, ownership threshold filter, absence from
candidates check) is Plan 05's TransferPanel useMemo responsibility. ExplainPanel renders all
rejectionReasons passed; the rejection reason computation is Plan 04/05's SquadView/TransferPanel
responsibility.

## Threat Flags

None — pure rendering components consuming trusted in-memory data. T-65-03 and T-65-04 from the
plan threat model are both satisfied by React's automatic JSX text-node escaping (no
`dangerouslySetInnerHTML` used in either component).

## Self-Check: PASSED

Files exist:
- src/components/squad/ExplainPanel.tsx: FOUND (modified — 59 lines)
- src/components/transfers/HighOwnershipCallout.tsx: FOUND (created — 55 lines)

Commits exist:
- d5894d4 (Task 1): FOUND
- ec3dc0c (Task 2): FOUND
