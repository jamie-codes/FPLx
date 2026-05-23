// @vitest-environment node
// Phase 134 (PUSH-01): /api/push/subscribe route contract tests

import { describe, it } from 'vitest'

describe('POST /api/push/subscribe', () => {
  it.todo('PUSH-01: stores subscription with sent_reminders initialised')
  it.todo('PUSH-01: returns 400 on malformed body')
})

describe('DELETE /api/push/subscribe', () => {
  it.todo('PUSH-01: removes subscription from Blob')
  it.todo('PUSH-01: returns 204 idempotent when no subscription present')
})
