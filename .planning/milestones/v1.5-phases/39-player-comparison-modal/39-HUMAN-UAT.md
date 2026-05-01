---
status: partial
phase: 39-player-comparison-modal
source: [39-VERIFICATION.md]
started: 2026-04-29T19:15:00.000Z
updated: 2026-04-29T19:15:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Desktop hover icon visibility
expected: ⊞ compare icon appears on player name hover (CSS opacity-0 group-hover/name:opacity-100), hidden when not hovering
result: [pending]

### 2. Modal opens centered with backdrop dimmed
expected: Clicking compare opens modal centred on screen with dimmed backdrop, Player A populated, search input auto-focused after 50ms
result: [pending]

### 3. Player B search returns all positions
expected: Typing a name searches all positions (no position filter, per D-04) and shows matching players
result: [pending]

### 4. Section order D-08
expected: Data sections render in this exact order: xPts Projection → Gem Scores → Next Fixtures → Signals
result: [pending]

### 5. Backdrop click closes modal
expected: Clicking the dark backdrop outside the modal dialog closes it and resets search/playerB
result: [pending]

### 6. Escape key closes modal
expected: Pressing Escape key closes modal and resets search/playerB
result: [pending]

### 7. ✕ button closes modal
expected: Clicking the ✕ close button closes modal and resets search/playerB
result: [pending]

### 8. Dark mode rendering
expected: Modal renders correctly in dark mode (no white-on-white or invisible text)
result: [pending]

### 9. Mobile action sheet
expected: On ≤640px viewport, desktop compare icon is hidden; tapping an expanded player row shows 'Compare' button in action sheet; tapping it opens modal
result: [pending]

### 10. Mobile stacked layout
expected: At ≤640px, modal columns stack vertically (single-column layout)
result: [pending]

### 11. iOS zoom guard
expected: On real Safari/iOS, the search input does not trigger auto-zoom (fontSize: 16px inline style applied)
result: [pending]

### 12. Modal persists during sub-tab navigation
expected: With modal open, switching between sub-tabs (Analyse/Plan/Squad) keeps modal visible — it is mounted outside the activeSubTab guard in page.tsx
result: [pending]

### 13. Player column sort preserved
expected: Clicking the Player column header still sorts the table (col.accessor('web_name') preserved, not col.display)
result: [pending]

### 14. No console errors
expected: Opening modal, selecting Player B, closing, re-opening with different player — no console errors or React warnings at any point
result: [pending]

## Summary

total: 14
passed: 0
issues: 0
pending: 14
skipped: 0
blocked: 0

## Gaps
