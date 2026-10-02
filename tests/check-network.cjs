const { chromium } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage();
  page.on("requestfailed", (request) => {
    if (request.url().includes("api-maps.yandex.ru"))
      console.log("SDK transport:", request.failure());
  });
  page.on("response", (response) => {
    if (response.url().includes("api-maps.yandex.ru"))
      console.log("SDK HTTP:", response.status());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "gps-monitor-yandex-key",
      "invalid-key-for-gps-prototype-test",
    ),
  );
  await page.goto("http://127.0.0.1:4200");
  await page
    .getByRole("heading", { name: "Карта недоступна", exact: true })
    .waitFor({ timeout: 25000 });
  await browser.close();
})();
