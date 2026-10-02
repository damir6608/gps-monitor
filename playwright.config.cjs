const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.cjs",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: [["list"], ["json", { outputFile: "artifacts/test-report.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4200",
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
});
