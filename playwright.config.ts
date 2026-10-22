import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:3000" },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile\.spec\.ts/,
    },
    // Phone app shell (A5): Safari on iPhone (WebKit) and Chrome on Android.
    {
      name: "iphone",
      use: { ...devices["iPhone 15"] },
      testMatch: /mobile\.spec\.ts/,
    },
    {
      name: "pixel",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: [
    {
      // Serves recorded real bulletins, re-dated to "now", so colours and panels can be tested in any season.
      command: "node tests/e2e/feed-stub.mjs",
      url: "http://localhost:4010/slf.json",
      reuseExistingServer: true,
    },
    {
      command: "npm run build && npm run start",
      url: "http://localhost:3000/en",
      reuseExistingServer: true,
      timeout: 240_000,
      env: {
        // Deterministic tests: never hit the live weather API.
        FORCE_MOCK_DATA: "1",
        AVALANCHE_EUREGIO_FEED_URL: "http://localhost:4010/euregio.json",
        AVALANCHE_SLF_FEED_URL: "http://localhost:4010/slf.json",
      },
    },
  ],
});
