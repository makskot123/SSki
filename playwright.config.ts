import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000/en",
    reuseExistingServer: true,
    // Deterministic tests: never hit the live weather API.
    env: { FORCE_MOCK_DATA: "1" },
    timeout: 240_000,
  },
});
