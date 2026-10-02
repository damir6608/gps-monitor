const { chromium } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
    page.on("requestfailed", (r) => {
      if (r.url().includes("yandex"))
        console.log(
          "NETWORK:",
          new URL(r.url()).hostname,
          r.failure()?.errorText,
        );
    });
    await page.addInitScript(
      (key) => localStorage.setItem("gps-monitor-yandex-key", key),
      process.env.GPS_TEST_KEY,
    );
    await page.goto("http://localhost:4200/", { timeout: 20000 });
    await page.waitForFunction(
      () => {
        const w = document.querySelector("app-tracker-workspace");
        return (
          w &&
          window.ng &&
          ["ready", "error"].includes(window.ng.getComponent(w).map.state())
        );
      },
      {},
      { timeout: 35000 },
    );
    console.log(
      await page.evaluate(() => {
        const w = window.ng.getComponent(
          document.querySelector("app-tracker-workspace"),
        );
        return {
          state: w.map.state(),
          error: w.map.error(),
          markers: document.querySelectorAll(".gps-marker").length,
          clusters: document.querySelectorAll(".gps-cluster").length,
          canvases: document.querySelectorAll("canvas").length,
          scriptCount: [...document.scripts].filter((s) =>
            s.src.includes("api-maps.yandex.ru/v3"),
          ).length,
        };
      }),
    );
    await page
      .locator("canvas")
      .first()
      .waitFor({ state: "attached", timeout: 25000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: "artifacts/live-map.png" });
    console.log("Map canvas loaded");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
