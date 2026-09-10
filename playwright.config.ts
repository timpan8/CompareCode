import { defineConfig, devices } from '@playwright/test'

/**
 * The end-to-end tests open the built file straight from disk, with no server at
 * all. That is the point: if the page needs a server for anything, these tests
 * find out.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    // Some environments ship a Chromium that Playwright did not download itself.
    // Point at it with CHROMIUM_PATH rather than fetching another copy.
    channel: process.env['CHROMIUM_PATH'] ? undefined : 'chromium',
    launchOptions: process.env['CHROMIUM_PATH']
      ? { executablePath: process.env['CHROMIUM_PATH'] }
      : {},
    viewport: { width: 1280, height: 900 },
  },
  projects: [{ name: 'chromium' }],
})
