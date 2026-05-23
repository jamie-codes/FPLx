// @vitest-environment node
// Phase 134 (PUSH-02..PUSH-05): /api/push/send route dispatch tests

import { describe, it } from 'vitest'

describe('POST /api/push/send', () => {
  it.todo("PUSH-02: dispatches via web-push when type='price'")
  it.todo("PUSH-03: dispatches via web-push when type='injury'")
  it.todo("PUSH-04: dispatches with hours_until when type='deadline'")
  it.todo("PUSH-05: dispatches via web-push when type='captain'")
  it.todo('returns 404 when no subscription stored in Blob')
})
