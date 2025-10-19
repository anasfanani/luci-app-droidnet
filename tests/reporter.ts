import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

class CleanReporter implements Reporter {
  onTestBegin(test: TestCase) {
    console.log(`Testing ${test.title}...`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === "failed") {
      const error = result.errors[0];
      if (error?.message?.includes("Console errors:")) {
        const pageName = test.title.replace(" Page", "").toLowerCase();
        console.log(`❌ ${test.title}: ${error.message}`);
        console.log(`   HTML: test-results/content/${pageName}-page.html`);
        console.log(`   JSON: test-results/json/${pageName}-result.json\n`);
      }
    } else if (result.status === "passed") {
      console.log(`✅ ${test.title}\n`);
    }
  }

  onEnd() {
    console.log("");
  }
}

export default CleanReporter;
