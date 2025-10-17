import { test, expect } from "@playwright/test";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

// Types
interface MenuConfig {
  [key: string]: {
    title: string;
    order: number;
    action?: {
      type: string;
      path?: string;
    };
  };
}

// Helper functions
async function saveDebugHtml(
  html: string,
  filename: string = "debug-output.html",
) {
  if (process.env.DEBUG_HTML !== "true") return;

  const testResultsDir = "test-results";
  await fs.promises.mkdir(testResultsDir, { recursive: true });

  const filePath = path.join(testResultsDir, filename);
  await fs.promises.writeFile(filePath, html);
  console.debug(`HTML saved to ${filePath}`);
}

async function loginWithJsonRpc(
  page: any,
  baseUrl: string,
  username: string,
  password: string,
) {
  const loginResponse = await page.request.post(
    `${baseUrl}/cgi-bin/luci/rpc/auth`,
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      data: {
        id: 1,
        method: "login",
        params: [username, password],
      },
    },
  );

  expect(loginResponse.status()).toBe(200);
  const loginData = await loginResponse.json();
  return loginData.result;
}

function loadMenuConfig(): MenuConfig {
  const menuPath = "src/root/usr/share/luci/menu.d/luci-app-droidnet.json";
  return JSON.parse(fs.readFileSync(menuPath, "utf8"));
}

function getTestPages() {
  const menu = loadMenuConfig();
  const pages = [];

  for (const [key, config] of Object.entries(menu)) {
    if (config.action?.type === "view" && config.action.path) {
      pages.push({
        title: config.title,
        url: `/cgi-bin/luci/${key}`,
        path: config.action.path,
        order: config.order,
      });
    }
  }

  return pages.sort((a, b) => a.order - b.order);
}

function parseDeviceInfo($: cheerio.CheerioAPI) {
  const deviceInfo: Record<string, string> = {};

  $("table")
    .eq(0)
    .find("tr")
    .each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 4) {
        const key1 = $(cells[0]).find("b").text().trim();
        const value1 = $(cells[1]).text().trim();
        const key2 = $(cells[2]).find("b").text().trim();
        const value2 = $(cells[3]).text().trim();

        if (key1) deviceInfo[key1] = value1;
        if (key2) deviceInfo[key2] = value2;
      }
    });

  return deviceInfo;
}

function parseBatteryInfo($: cheerio.CheerioAPI) {
  const batteryInfo: Record<string, string> = {};

  $("table")
    .eq(1)
    .find("tr")
    .each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const key = $(cells[0]).find("b").text().trim();
        const value = $(cells[1]).text().trim();
        if (key) batteryInfo[key] = value;
      }
    });

  return batteryInfo;
}

// Global token storage
let authToken: string;

test.describe("DroidNet Tests", () => {
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

  test("Device Page", async ({ page }) => {
    const baseUrl = process.env.LUCI_BASE_URL!;

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

    await page.goto(`${baseUrl}/cgi-bin/luci/admin/services/droidnet/device`, {
      waitUntil: "networkidle",
    });

    const html = await page.content();
    await saveDebugHtml(html, "device-page.html");

    const $ = cheerio.load(html);

    const deviceInfo = parseDeviceInfo($);
    const batteryInfo = parseBatteryInfo($);

    console.debug("Device Info:", deviceInfo);
    console.debug("Battery Info:", batteryInfo);

    expect(Object.keys(deviceInfo).length).toBeGreaterThan(0);
    expect(Object.keys(batteryInfo).length).toBeGreaterThan(0);
  });

  // Generate tests for other pages
  const testPages = getTestPages().filter((p) => p.title !== "Device");

  for (const pageConfig of testPages) {
    test(`${pageConfig.title} Page`, async ({ page }) => {
      const baseUrl = process.env.LUCI_BASE_URL!;

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

      // Basic validation - page loaded successfully
      expect(html).toContain(pageConfig.title);
      console.debug(`${pageConfig.title} page loaded successfully`);
    });
  }
});
