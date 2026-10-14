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
  timeout: 120000,
  expect: {
    timeout: 15000
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],
  // (2026-07-13) Maximize browser window and set viewport null; was 800x850
  use: {
    baseURL: 'http://127.0.0.1:8181',
    headless: false,
    trace: 'on-first-retry',
    viewport: null,
    launchOptions: {
      args: ['--start-maximized']
    }
  },
  projects: [
    {
      name: 'chromium',
      use: {
        viewport: null,
        launchOptions: {
          args: ['--start-maximized']
        }
      }
    }
  ],
  webServer: {
    command: 'node scripts/serve.js',
    url: 'http://127.0.0.1:8181',
    reuseExistingServer: true,
    timeout: 10000
  }
});
