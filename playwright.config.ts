import { defineConfig } from 'playwright/test'

// biome-ignore lint/style/noDefaultExport: Playwright config loader expects default export
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3009',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'pnpm run dev -- --host 127.0.0.1 --port 3009',
    url: 'http://127.0.0.1:3009',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
