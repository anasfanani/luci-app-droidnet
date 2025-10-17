import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import { parsePage } from "./parsers";

async function testParsers() {
  const contentDir = "test-results/content";
  const jsonDir = "test-results/parser";

  // Create parser directory
  await fs.promises.mkdir(jsonDir, { recursive: true });

  try {
    const files = await fs.promises.readdir(contentDir);

    for (const file of files) {
      if (!file.endsWith(".html")) continue;

      const pageName = file.replace("-page.html", "");
      const title = pageName.charAt(0).toUpperCase() + pageName.slice(1);

      console.log(`\n=== Testing ${title} Parser ===`);

      const htmlPath = path.join(contentDir, file);
      const html = await fs.promises.readFile(htmlPath, "utf8");

      const $ = cheerio.load(html);
      const result = parsePage(title, $);

      // Save JSON result
      const jsonPath = path.join(jsonDir, `${pageName}-result.json`);
      await fs.promises.writeFile(jsonPath, JSON.stringify(result, null, 2));
      console.log(`Saved result to ${jsonPath}`);

      console.log("Result:", JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error("Error testing parsers:", error);
  }
}

testParsers();
