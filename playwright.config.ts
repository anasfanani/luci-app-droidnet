import { defineConfig } from "@playwright/test";
import "dotenv/config";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
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
