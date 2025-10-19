import { defineConfig } from "@playwright/test";
import "dotenv/config";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: false, // Run tests serially to ensure Login runs first
  workers: 1, // Single worker to maintain test order
  reporter: [["./tests/reporter.ts"]],
  use: {
    headless: true,
    browserName: "chromium",
    launchOptions: {
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--verbose"],
    },
    trace: "off",
  },
});
