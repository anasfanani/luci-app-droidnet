import { execSync } from "child_process";
import { cp, rm } from "fs/promises";
import { existsSync } from "fs";

// Clean dist
if (existsSync("dist")) {
  await rm("dist", { recursive: true });
}

// Build TypeScript with tsc
execSync("tsc", { stdio: "inherit" });

// Copy root directory
await cp("src/root", "dist/root", { recursive: true });
await cp(
  "src/htdocs/luci-static/resources/svg",
  "dist/htdocs/luci-static/resources/svg",
  { recursive: true },
);
await cp("src/Makefile", "dist/Makefile");

console.log("Build completed!");
