---
status: partial
phase: 02-understat-pipeline-merged-data-api
source: [02-VERIFICATION.md]
started: 2026-03-28T12:00:00.000Z
updated: 2026-03-28T12:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Understat xG/xA match quality
expected: Run `python pipeline/run.py` with internet access and verify Salah, Haaland, Palmer, Saka, Mbeumo all have non-null xg_per90/xa_per90 in merged_players.json
result: [pending]

### 2. Production response time
expected: Deploy to Vercel with USE_BLOB=true, verify /api/players responds under 500ms with warm Blob cache
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
