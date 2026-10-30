import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : Number(process.env.E2E_RETRIES ?? 0),
  globalTeardown: "./e2e/global-teardown.ts",
  // Slower against a hosted test database: E2E_EXPECT_TIMEOUT=25000 E2E_TEST_TIMEOUT=120000 E2E_RETRIES=1.
  timeout: Number(process.env.E2E_TEST_TIMEOUT ?? 30_000),
  expect: { timeout: Number(process.env.E2E_EXPECT_TIMEOUT ?? 10_000) },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 13"] } },
    { name: "tablet", use: { ...devices["iPad (gen 7)"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: process.env.CI ? `pnpm start --port ${port}` : `pnpm dev --port ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
  },
});
