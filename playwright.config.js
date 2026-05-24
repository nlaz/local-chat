// playwright.config.js — uses system chromium (no download needed)
const { defineConfig } = require('@playwright/test');

const BASE = process.env.TEST_BASE || 'http://localhost';

module.exports = defineConfig({
  testDir: './test/browser',
  timeout: 20000,
  use: {
    baseURL: BASE,
    headless: true,
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      executablePath: '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  },
  projects: [
    { name: 'chromium' },
  ],
});
