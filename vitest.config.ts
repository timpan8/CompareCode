import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The end-to-end specs are Playwright's; vitest owns the unit tests only.
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
})
