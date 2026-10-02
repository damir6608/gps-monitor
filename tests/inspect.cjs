const { chromium } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto("http://127.0.0.1:4200");
  await page.waitForTimeout(2000);
  console.log((await page.locator("body").innerText()).slice(0, 3500));
  await page.screenshot({ path: "artifacts/workspace.png", fullPage: true });
  await browser.close();
})();
