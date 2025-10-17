import * as fs from "fs";
import * as path from "path";
import { expect } from "@playwright/test";
import * as cheerio from "cheerio";

// Types
export interface MenuConfig {
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
export async function saveDebugHtml(
  html: string,
  filename: string = "debug-output.html",
) {
  if (process.env.DEBUG_HTML !== "true") return;

  const htmlDir = "test-results/html";
  await fs.promises.mkdir(htmlDir, { recursive: true });

  const filePath = path.join(htmlDir, filename);
  await fs.promises.writeFile(filePath, html);
  console.debug(`HTML saved to ${filePath}`);
}

export async function saveHtmlContent(html: string, filename: string) {
  const contentDir = "test-results/content";
  await fs.promises.mkdir(contentDir, { recursive: true });

  const $ = cheerio.load(html);
  const content = $("#maincontent .container #view .cbi-map").html();

  if (content) {
    // Try to use prettier if available, otherwise save as-is
    let prettified = content;
    try {
      const prettier = require("prettier");
      prettified = await prettier.format(content, {
        parser: "html",
        printWidth: 100,
        tabWidth: 2,
        useTabs: false,
        htmlWhitespaceSensitivity: "ignore",
      });
    } catch (e) {
      // Prettier not available, use raw content
    }

    const filePath = path.join(contentDir, filename);
    await fs.promises.writeFile(filePath, prettified);
    console.debug(`HTML content saved to ${filePath}`);
  }
}

export async function saveParserResult(result: any, filename: string) {
  const jsonDir = "test-results/json";
  await fs.promises.mkdir(jsonDir, { recursive: true });

  const filePath = path.join(jsonDir, `${filename}.json`);
  await fs.promises.writeFile(filePath, JSON.stringify(result, null, 2));
  console.debug(`Parser result saved to ${filePath}`);
}

export async function loginWithJsonRpc(
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

export function loadMenuConfig(): MenuConfig {
  const menuPath = "src/root/usr/share/luci/menu.d/luci-app-droidnet.json";
  return JSON.parse(fs.readFileSync(menuPath, "utf8"));
}

export function getTestPages() {
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

  let filteredPages = pages.sort((a, b) => a.order - b.order);

  // Filter pages based on TEST_PAGES environment variable
  const testPages = process.env.TEST_PAGES;
  if (testPages) {
    const allowedPages = testPages.split(",").map((p) => p.trim());
    filteredPages = filteredPages.filter((page) =>
      allowedPages.includes(page.title),
    );
    console.debug(
      `Running tests for: ${filteredPages.map((p) => p.title).join(", ")}`,
    );
  }

  return filteredPages;
}
