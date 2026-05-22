---
status: partial
phase: 133-price-reset-analysis
source: [133-VERIFICATION.md]
started: 2026-05-22T17:10:00.000Z
updated: 2026-05-22T17:10:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Price Reset tab appears in correct position
expected: Analyse section shows "Price Reset" tab between "Summer Window" and "Price Changes"; mobile label "Resets"
result: [pending]

### 2. Empty state renders correctly (no baseline)
expected: Without price_baseline.json, tab shows heading "Prices not yet published" and body "FPL typically publishes new prices in mid-to-late July"
result: [pending]

### 3. Delta pills render correctly
expected: Rise rows show green pill with "+" prefix; fall rows show red pill with Unicode minus "−" (U+2212, not a hyphen)
result: [pending]

### 4. Value Target row format
expected: Value Target metadata includes "#N POS" format (e.g. "#3 MID")
result: [pending]

### 5. ARIA labels and no console errors
expected: section elements have aria-label="Price reset analysis" and aria-label="Value targets — price fell, xPts above median"; no React console errors
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
