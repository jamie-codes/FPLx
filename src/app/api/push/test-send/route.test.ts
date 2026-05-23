// @vitest-environment node
// Phase 134 (PUSH-02..PUSH-05): /api/push/test-send dev-only contract tests

import { describe, it } from 'vitest'

describe('POST /api/push/test-send', () => {
  it.todo('T-134-01: returns 404 when NODE_ENV === production')
  it.todo('returns 403 without Authorization: Bearer PUSH_TEST_SECRET header')
  it.todo('returns 403 when Bearer token does not match PUSH_TEST_SECRET')
  it.todo('dispatches canned payload via /api/push/send for each type in {price, injury, deadline, captain}')
})
