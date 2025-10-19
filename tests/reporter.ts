import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

class CleanReporter implements Reporter {
  onTestBegin(test: TestCase) {
    console.log(`Testing ${test.title}...`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const pageName = test.title.replace(" Page", "").toLowerCase();

    if (result.status === "failed") {
      const error = result.errors[0];
      if (error?.message?.includes("Console errors")) {
        console.log(`❌ ${test.title}: Console errors detected`);
        console.log(`   ${error.message.split("\n").slice(1).join("\n   ")}`);
        console.log(`   HTML: test-results/content/${pageName}-page.html`);
        console.log(`   JSON: test-results/json/${pageName}-result.json\n`);
      } else {
        console.log(`❌ ${test.title}: ${error?.message || "Unknown error"}`);
      }
    } else if (result.status === "passed") {
      // Check stdout for warnings
      const stdout = result.stdout.map((s) => s.toString()).join("");
      const hasWarnings = stdout.includes("⚠️  Console warnings");

      if (hasWarnings) {
        console.log(`✅ ${test.title} (with warnings)`);
        // Extract and show warnings
        const warningLines = stdout
          .split("\n")
          .filter((line) => line.includes("⚠️") || line.trim().startsWith("-"));
        warningLines.forEach((line) => console.log(`   ${line.trim()}`));
        console.log("");
      } else {
        console.log(`✅ ${test.title}\n`);
      }
    }
  }

  onEnd() {
    console.log("");
  }
}

export default CleanReporter;
