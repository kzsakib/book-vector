import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'off',
  },
  projects: [
    {
      name: 'desktop',
      // The headless shell build cannot load a font backend in this container;
      // the full Chromium build ships one.
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3000 --strictPort',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
