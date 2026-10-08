// ============================================================
// playwright.config.js - Route 98 POS Automated Testing Config
// Enables VS Code Test Explorer integration & CLI runners
// ============================================================
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.js$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: {
    timeout: 15000
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],
  use: {
    baseURL: 'http://127.0.0.1:8181',
    headless: false,
    trace: 'on-first-retry',
    viewport: { width: 800, height: 850 }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'node scripts/serve.js',
    url: 'http://127.0.0.1:8181',
    reuseExistingServer: true,
    timeout: 10000
  }
});
