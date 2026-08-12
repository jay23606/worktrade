import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "zoom-200", use: { viewport: { width: 640, height: 720 } } },
  ],
  webServer: {
    command: "node scripts/static-server.mjs",
    url: "http://127.0.0.1:8080",
    reuseExistingServer: !process.env.CI,
  },
});
