import { test, expect, type Page } from '@playwright/test'

/**
 * Phase 77 POL-03: 430px mobile overflow audit.
 * Asserts no tab on the home page produces horizontal body scroll at Galaxy S26+ width.
 * Baseline depends on Plan 01: AccuracyTab now has overflow-x-auto wrappers; LineupTab kit images
 * are object-contain w-6 h-6; DecisionSummaryTab captain row uses sm:flex-wrap.
 *
 * Navigation at 430px uses the MobileNav component (sm:hidden desktop nav is invisible):
 *   - Bottom section bar buttons: "Analyse", "Plan", "Squad"
 *   - Sub-tab pill row buttons use mobileLabel values from SECTIONS constant
 */

type TabSpec = {
  name: string
  navigate: (page: Page) => Promise<void>
  settle: (page: Page) => Promise<void>
}

const TABS: TabSpec[] = [
  {
    // Insights is in the Analyse section (default section on load), sub-tab mobileLabel="Insights"
    name: 'Insights',
    navigate: async (p) => {
      // Ensure Analyse section is active (default, but make it explicit)
      await p.getByRole('button', { name: 'Analyse', exact: true }).click()
      await p.getByRole('button', { name: 'Insights', exact: true }).first().click()
    },
    settle: async (p) => {
      // InsightsTab renders a <section aria-label="Season pattern insights"> or <section aria-label="Insights not available">
      await p.locator('section[aria-label="Season pattern insights"], section[aria-label="Insights not available"]').first().waitFor({ timeout: 15_000 })
    },
  },
  {
    // Plan section — default sub-tab is Planner, which renders ChipStrategyPanel
    name: 'Plan',
    navigate: async (p) => {
      await p.getByRole('button', { name: 'Plan', exact: true }).click()
    },
    settle: async (p) => {
      // ChipStrategyPanel always renders (even without squad data), so this is stable
      await p.getByTestId('chip-strategy-panel').waitFor({ timeout: 15_000 })
    },
  },
  {
    // Squad section → Lineup sub-tab. LineupTab has data-testid="lineup-tab".
    // Without a team ID submitted, it renders the empty-state (a section with data-testid="lineup-tab").
    name: 'Squad',
    navigate: async (p) => {
      await p.getByRole('button', { name: 'Squad', exact: true }).click()
      await p.getByRole('button', { name: 'Lineup', exact: true }).click()
    },
    settle: async (p) => {
      await p.getByTestId('lineup-tab').waitFor({ timeout: 15_000 })
    },
  },
  {
    // Set Pieces is in the Analyse section, mobileLabel="SP"
    name: 'Set Pieces',
    navigate: async (p) => {
      await p.getByRole('button', { name: 'Analyse', exact: true }).click()
      await p.getByRole('button', { name: 'SP', exact: true }).click()
    },
    settle: async (p) => {
      // SetPieceTakerPanel renders <h2>Set-Piece Takers</h2>
      await p.getByRole('heading', { name: 'Set-Piece Takers' }).waitFor({ timeout: 15_000 })
    },
  },
  {
    // Accuracy is in the Analyse section, mobileLabel="Acc"
    name: 'Accuracy',
    navigate: async (p) => {
      await p.getByRole('button', { name: 'Analyse', exact: true }).click()
      await p.getByRole('button', { name: 'Acc', exact: true }).click()
    },
    settle: async (p) => {
      // AccuracyTab renders a calibration chart or GW rows; fallback to the section container
      await p.locator('[data-testid="calibration-chart"], [data-testid^="gw-row-"]').first().waitFor({ timeout: 15_000 })
    },
  },
  {
    // Rivals is in the Plan section, mobileLabel="Rivals"
    name: 'Rivals',
    navigate: async (p) => {
      await p.getByRole('button', { name: 'Plan', exact: true }).click()
      await p.getByRole('button', { name: 'Rivals', exact: true }).click()
    },
    settle: async (p) => {
      // RivalsTab renders <h2>Track your mini-league rivals</h2>
      await p.getByRole('heading', { name: 'Track your mini-league rivals' }).waitFor({ timeout: 15_000 })
    },
  },
  {
    // Value Gems is in the Plan section, mobileLabel="Values"
    name: 'Value Gems',
    navigate: async (p) => {
      await p.getByRole('button', { name: 'Plan', exact: true }).click()
      await p.getByRole('button', { name: 'Values', exact: true }).click()
    },
    settle: async (p) => {
      // ValueGemsTable renders <h1>Value Gems</h1>
      await p.getByRole('heading', { name: 'Value Gems' }).waitFor({ timeout: 15_000 })
    },
  },
]

test.describe('POL-03 — 430px mobile overflow audit', () => {
  for (const tab of TABS) {
    test(`${tab.name} tab does not overflow 430px viewport horizontally`, async ({ page }) => {
      await page.goto('/')
      await tab.navigate(page)
      await tab.settle(page)
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.body.scrollWidth,
        innerWidth: window.innerWidth,
      }))

      expect(
        overflow.scrollWidth,
        `${tab.name} tab: body.scrollWidth (${overflow.scrollWidth}px) > window.innerWidth (${overflow.innerWidth}px) — horizontal overflow detected at 430px viewport`,
      ).toBeLessThanOrEqual(overflow.innerWidth)
    })
  }
})
