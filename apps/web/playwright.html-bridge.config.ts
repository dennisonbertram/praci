import { defineConfig } from "@playwright/test";

// Offline: only a Vite dev server for the static viewer shell and a test harness page. No API or database.
const port = 5791;
export default defineConfig({
  testDir: "./e2e",
  testMatch: "html-bridge.spec.ts",
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined },
  },
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/e2e/bridge-harness/index.html`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
