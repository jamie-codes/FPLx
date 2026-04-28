import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    // jsdom is the global environment so that *.test.tsx files can render JSX.
    // All existing *.test.ts unit tests are DOM-agnostic and pass in jsdom without change.
    // Vitest v4 removed environmentMatchGlobs; jsdom is a safe superset for this codebase.
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
