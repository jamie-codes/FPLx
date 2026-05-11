import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    // jsdom is the global environment so that *.test.tsx files can render JSX.
    // All existing *.test.ts unit tests are DOM-agnostic and pass in jsdom without change.
    // Vitest v4 removed environmentMatchGlobs; jsdom is a safe superset for this codebase.
    environment: 'jsdom',
    // Phase 96 Rule 3: Node v25 ships an experimental localStorage stub that breaks jsdom tests.
    // vitest.setup.ts patches window.localStorage/sessionStorage with jsdom-backed Storage objects.
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
