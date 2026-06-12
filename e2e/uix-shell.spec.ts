import { test, expect } from '@playwright/test'
import { ALL_TOOL_IDS } from '../src/lib/navigation'

/**
 * UIX-01 Task 6: 28-tool × 2-viewport shell smoke.
 * Asserts that every tool route (?t=<id>) loads without a pageerror.
 * console.error noise from off-season data states is NOT a failure —
 * only uncaught exceptions caught by page.on('pageerror') count.
 */

for (const viewport of [
  { width: 1440, height: 900, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile' },
]) {
  test.describe(`shell smoke — ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    for (const toolId of ALL_TOOL_IDS) {
      test(`renders ${toolId}`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(String(e)))

        await page.goto(`/?t=${toolId}`)

        // networkidle can hang on polling tabs (e.g. live tab when fixtures are active).
        // Use a catch+fallback: try networkidle first; if it times out, fall back to
        // 'load' + a 1 s settle so the test still completes.
        await page
          .waitForLoadState('networkidle', { timeout: 12_000 })
          .catch(async () => {
            // networkidle timed out — acceptable for polling tabs in off-season state
            await page.waitForLoadState('load')
            await page.waitForTimeout(1_000)
          })

        expect(errors, `pageerrors on tool "${toolId}"`).toEqual([])
      })
    }
  })
}
