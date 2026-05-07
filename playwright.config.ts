import { defineConfig, devices } from '@playwright/test'

/**
 * Phase 77 POL-03 mobile overflow audit.
 * Single Chromium project at 430x900 (Galaxy S26+ width).
 * Auto-spawns `npm run dev` and waits for http://localhost:3000.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    viewport: { width: 430, height: 900 },
  },
  projects: [
    {
      name: 'mobile-chromium-430',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 430, height: 900 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
