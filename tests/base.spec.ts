import { test, expect } from "@playwright/test";
import * as cheerio from "cheerio";
import { parsePage } from "./parsers";
import {
  saveDebugHtml,
  saveHtmlContent,
  saveParserResult,
  loginWithJsonRpc,
  getTestPages,
} from "./helpers";

// Global token storage
let authToken: string | undefined;
const consoleErrors: string[] = [];
const consoleWarnings: string[] = [];

test.describe.serial("DroidNet Tests", () => {
  test.beforeEach(({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      } else if (msg.type() === "warning") {
        consoleWarnings.push(msg.text());
      }
    });
  });

  test.afterEach(({ page }, testInfo) => {
    // Report warnings (non-blocking)
    if (consoleWarnings.length > 0) {
      console.log(`⚠️  Console warnings (${testInfo.title}):`);
      consoleWarnings.forEach((warning) => console.log(`   - ${warning}`));
    }

    // Fail on errors
    if (consoleErrors.length > 0) {
      throw new Error(
        `❌ Console errors detected:\n${consoleErrors.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
  });

  test("Login", async ({ page }) => {
    const baseUrl = process.env.LUCI_BASE_URL;
    const username = process.env.LUCI_USERNAME;
    const password = process.env.LUCI_PASSWORD;

    if (!baseUrl)
      throw new Error("LUCI_BASE_URL environment variable is required");
    if (!username)
      throw new Error("LUCI_USERNAME environment variable is required");
    if (password === undefined)
      throw new Error("LUCI_PASSWORD environment variable is required");

    authToken = await loginWithJsonRpc(page, baseUrl, username, password);
    console.debug("Auth token:", authToken);
    expect(authToken).toBeTruthy();
  });

  // Generate tests for all pages dynamically
  const testPages = getTestPages();

  for (const pageConfig of testPages) {
    test(`${pageConfig.title} Page`, async ({ page }) => {
      const baseUrl = process.env.LUCI_BASE_URL!;

      if (!authToken) {
        throw new Error(
          "Auth token not available. Login test may have failed.",
        );
      }

      await page.context().addCookies([
        {
          name: "sysauth_http",
          value: authToken,
          domain: new URL(baseUrl).hostname,
          path: "/",
        },
        {
          name: "sysauth",
          value: authToken,
          domain: new URL(baseUrl).hostname,
          path: "/",
        },
      ]);

      await page.goto(`${baseUrl}${pageConfig.url}`, {
        waitUntil: "networkidle",
      });

      const html = await page.content();
      await saveDebugHtml(html, `${pageConfig.title.toLowerCase()}-page.html`);
      await saveHtmlContent(
        html,
        `${pageConfig.title.toLowerCase()}-page.html`,
      );

      const $ = cheerio.load(html);
      const result = parsePage(pageConfig.title, $);

      await saveParserResult(
        result,
        `${pageConfig.title.toLowerCase()}-result`,
      );

      console.debug(`${pageConfig.title} Page Result:`, result);
      expect(result).toBeTruthy();
      expect(html).toContain(pageConfig.title);
    });
  }
});
