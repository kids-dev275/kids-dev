import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/helpers/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://localhost:3000",
    channel: "chrome",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
      },
      testIgnore: ["**/*mobile*.spec.ts"],
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        channel: "chrome",
      },
      testMatch: ["**/*mobile*.spec.ts"],
    },
  ],
  webServer: [
    {
      command: "pnpm --filter api start:e2e",
      url: "http://127.0.0.1:4000/api/v1/e2e/health",
      timeout: 60000,
      reuseExistingServer: true,
    },
    {
      command: "pnpm --filter web start",
      url: "http://localhost:3000",
      timeout: 60000,
      reuseExistingServer: true,
      env: {
        PORT: "3000",
        INTERNAL_API_URL: "http://localhost:4000/api/v1",
        NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
      },
    },
  ],
});
