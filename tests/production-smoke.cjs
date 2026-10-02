const { chromium } = require("@playwright/test");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const { resolve, extname, sep } = require("node:path");
(async () => {
  const root = resolve("dist/gps-monitor/browser");
  const server = createServer(async (req, res) => {
    try {
      const file = resolve(
        root,
        "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
      );
      if (!file.startsWith(root + sep) && file !== root) {
        res.writeHead(403).end();
        return;
      }
      const path = extname(file) ? file : resolve(root, "index.html");
      const body = await readFile(path);
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript",
          ".css": "text/css",
          ".json": "application/json",
        }[extname(path)] ?? "application/octet-stream",
      );
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(4300, "127.0.0.1", r));
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4300");
    await page
      .getByRole("heading", { name: "Подключите карту", exact: true })
      .waitFor();
    await page
      .getByLabel("Поиск трекеров", { exact: true })
      .fill("Lada Largus · 02");
    await page.locator(".trackers-panel tbody tr").click();
    await page
      .getByRole("button", { name: "Показать маршрут", exact: true })
      .waitFor();
    await page.screenshot({
      path: "artifacts/production-workspace.png",
      fullPage: true,
    });
    if (errors.length) throw Error(errors.join("\n"));
    console.log(
      "Production smoke passed: boot, filter, selection, tracker details; no page errors.",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
