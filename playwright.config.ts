import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'on',
    viewport: { width: 1400, height: 900 },
  },
  webServer: undefined, // Assume dev server is already running
});
