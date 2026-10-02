const { test, expect } = require("@playwright/test");
const path = require("node:path");
const rows = (p) => p.locator(".trackers-panel tbody tr");
const eventRows = (p) => p.locator(".events-panel tbody tr");
async function state(page) {
  return page.evaluate(() => {
    const c = window.ng.getComponent(
      document.querySelector("app-tracker-workspace"),
    );
    return {
      ids: c.vm.filtered().map((t) => t.id),
      mapCount: c.map.objectCount(),
      page: c.vm.trackerPage(),
      eventPage: c.vm.eventPage(),
      selected: c.vm.selectedId(),
      event: c.vm.selectedEvent(),
      route: c.vm.routeVisible(),
      camera: c.vm.cameraCommand(),
      events: c.vm.filteredEvents(),
      trackers: c.vm.trackers(),
    };
  });
}
async function fake(page) {
  await page.route("https://api-maps.yandex.ru/v3/**", (route) =>
    route.fulfill({
      path: path.join(__dirname, "fake-yandex.js"),
      contentType: "application/javascript",
    }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("gps-monitor-yandex-key", "test-key"),
  );
}
test("Таблица трекеров: общий поиск, фильтры, сортировка, пагинация и пустая выборка", async ({
  page,
}) => {
  await page.goto("/");
  await expect(rows(page)).toHaveCount(10);
  await expect(page.getByTestId("map-count")).toContainText("80");
  await page
    .getByLabel("Статус трекера", { exact: true })
    .selectOption("moving");
  await expect(page.getByTestId("map-count")).toContainText("53");
  await page
    .getByLabel("Страницы трекеров")
    .getByRole("button", { name: "Следующая страница", exact: true })
    .click();
  expect((await state(page)).page).toBe(1);
  expect((await state(page)).mapCount).toBe(53);
  await page
    .locator(".trackers-panel")
    .getByRole("button", { name: "км/ч", exact: true })
    .click();
  const speeds = await rows(page)
    .locator(".mat-column-speed")
    .allTextContents();
  expect(speeds.map(Number)).toEqual(speeds.map(Number).sort((a, b) => a - b));
  await page
    .getByLabel("Подразделение", { exact: true })
    .selectOption("Центральный парк");
  const grouped = await state(page);
  expect(
    grouped.ids.every(
      (id) =>
        grouped.trackers.find((t) => t.id === id).group === "Центральный парк",
    ),
  ).toBe(true);
  await page.getByLabel("Поиск трекеров", { exact: true }).fill("Алексей");
  const s = await state(page);
  expect(s.ids.length).toBeGreaterThan(0);
  expect(
    s.ids.every(
      (id) => s.trackers.find((t) => t.id === id).driver === "Алексей Морозов",
    ),
  ).toBe(true);
  expect(s.mapCount).toBe(s.ids.length);
  expect(s.page).toBe(0);
  await rows(page).first().click();
  await expect(
    page.getByRole("button", { name: "Показать маршрут", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Показать маршрут", exact: true })
    .click();
  expect((await state(page)).route).toBe(true);
  await page
    .getByLabel("Поиск трекеров", { exact: true })
    .fill("нет-такого-объекта");
  await expect(
    page.getByText("Транспорт не найден", { exact: true }),
  ).toBeVisible();
  expect((await state(page)).selected).toBeNull();
  expect((await state(page)).route).toBe(false);
  expect((await state(page)).mapCount).toBe(0);
  await expect(eventRows(page)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Сбросить фильтры", exact: true })
    .click();
  await expect(rows(page)).toHaveCount(10);
});
test("События: сортировка, страницы, тип, важность, поиск и связанный выбор", async ({
  page,
}) => {
  await page.goto("/");
  await expect(eventRows(page)).toHaveCount(10);
  await page
    .getByLabel("Страницы событий")
    .getByRole("button", { name: "Следующая страница", exact: true })
    .click();
  expect((await state(page)).eventPage).toBe(1);
  await page
    .locator(".events-panel")
    .getByRole("button", { name: "Время", exact: true })
    .click();
  const times = await page.evaluate(() =>
    window.ng
      .getComponent(document.querySelector("app-tracker-workspace"))
      .vm.eventRows()
      .map((e) => e.time),
  );
  expect(times).toEqual([...times].sort((a, b) => a - b));
  await page.getByLabel("Тип события", { exact: true }).selectOption("speed");
  await page
    .getByLabel("Важность события", { exact: true })
    .selectOption("warning");
  await page.getByLabel("Поиск событий", { exact: true }).fill("лимите");
  const s = await state(page);
  expect(s.events.length).toBeGreaterThan(0);
  expect(
    s.events.every((e) => e.type === "speed" && e.severity === "warning"),
  ).toBe(true);
  await eventRows(page).first().click();
  const selected = await state(page);
  expect(selected.selected).toBe(selected.event.trackerId);
  expect(selected.camera.coordinates).toEqual(selected.event.coordinates);
  await expect(page.locator(".event-detail")).toBeVisible();
  await expect(page.locator(".trackers-panel .selected-row")).toHaveCount(1);
  await page.getByLabel("Только выбранный трекер", { exact: true }).check();
  expect(
    (await state(page)).events.every((e) => e.trackerId === selected.selected),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Снять выбор ×", exact: true })
    .click();
  await expect(eventRows(page)).toHaveCount(0);
});
test("Сплиттеры: клавиатура, указатель, сброс и небольшой контейнер", async ({
  page,
}) => {
  await page.goto("/");
  const vertical = page.getByRole("separator", {
    name: "Ширина колонок таблиц и карты",
  });
  await vertical.focus();
  await page.keyboard.press("ArrowRight");
  await expect(vertical).toHaveAttribute("aria-valuenow", "47");
  const box = await vertical.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 40);
  await page.mouse.up();
  expect(Number(await vertical.getAttribute("aria-valuenow"))).toBeGreaterThan(
    47,
  );
  const horizontal = page.getByRole("separator", {
    name: "Высота карты и карточки трекера",
  });
  await horizontal.focus();
  await page.keyboard.press("ArrowUp");
  await expect
    .poll(async () => Number(await horizontal.getAttribute("aria-valuenow")))
    .toBeLessThan(60);
  await page
    .getByRole("button", { name: "Сбросить расположение", exact: true })
    .click();
  await expect(vertical).toHaveAttribute("aria-valuenow", "45");
  await expect(horizontal).toHaveAttribute("aria-valuenow", "60");
  await page.setViewportSize({ width: 480, height: 640 });
  await expect(page.locator("section.panel")).toHaveCount(4);
  expect(
    await page
      .locator(".workspace-scroll")
      .evaluate(
        (e) => e.scrollWidth > e.clientWidth && e.scrollHeight > e.clientHeight,
      ),
  ).toBe(true);
  await page.locator(".detail-panel").scrollIntoViewIfNeeded();
  await expect(page.locator(".detail-panel")).toBeVisible();
});
test("Имитация сохраняет фильтры, выбор, страницу и ограничивает историю", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Статус трекера", { exact: true })
    .selectOption("moving");
  await page
    .getByLabel("Страницы трекеров")
    .getByRole("button", { name: "Следующая страница", exact: true })
    .click();
  await rows(page).first().click();
  const before = await state(page);
  await page.getByRole("switch", { name: "Имитация движения" }).click();
  await expect
    .poll(async () => {
      const s = await state(page);
      return s.trackers.some(
        (t, i) => t.lastMessage !== before.trackers[i].lastMessage,
      );
    })
    .toBe(true);
  const after = await state(page);
  expect(after.page).toBe(before.page);
  expect(after.selected).toBe(before.selected);
  expect(after.ids).toEqual(before.ids);
  expect(after.camera).toEqual(before.camera);
  await page.getByRole("switch", { name: "Имитация движения" }).click();
  await page.evaluate(() => {
    const vm = window.ng.getComponent(
      document.querySelector("app-tracker-workspace"),
    ).vm;
    for (let i = 0; i < 140; i++) vm.advance();
  });
  expect((await state(page)).events.length).toBeLessThanOrEqual(600);
  await page
    .getByRole("button", { name: "Сбросить демо", exact: true })
    .click();
  await expect(page.getByTestId("map-count")).toContainText("80");
  expect((await state(page)).trackers).toEqual(before.trackers);
  expect((await state(page)).selected).toBeNull();
});
test("Отсутствующий ключ, некорректный ключ и восстановление после сетевой ошибки", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Подключите карту", exact: true }),
  ).toBeVisible();
  await page.route("https://api-maps.yandex.ru/v3/**", (route) =>
    route.fulfill({ status: 403, body: "Invalid API key" }),
  );
  await page.getByRole("button", { name: "Настроить подключение" }).click();
  await page
    .getByLabel("Ключ Яндекс Карт", { exact: true })
    .fill("invalid-test-key");
  await page.getByRole("button", { name: "Подключить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Карта недоступна" }),
  ).toBeVisible();
  await expect(rows(page)).toHaveCount(10);
  await page.unroute("https://api-maps.yandex.ru/v3/**");
  await fake(page);
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Увеличить масштаб" }),
  ).toBeVisible();
});
test("Карта: официальный clusterByGrid, маркеры, маршрут, камера, события и совпадения (SDK double)", async ({
  page,
}) => {
  await fake(page);
  await page.goto("/");
  await expect(page.locator(".gps-cluster").first()).toBeVisible();
  const initialClusters = await page.locator(".gps-cluster").count();
  expect(initialClusters).toBeGreaterThan(0);
  await page.getByLabel("Поиск трекеров", { exact: true }).fill("Hyundai");
  await expect(page.getByTestId("map-count")).toContainText("13");
  expect(
    await page.evaluate(
      () =>
        window.ng.getComponent(document.querySelector("app-tracker-workspace"))
          .map.clusterer._props.features.length,
    ),
  ).toBe(13);
  await page.locator(".gps-marker").first().click();
  const selected = await state(page);
  await expect(page.locator(".trackers-panel .selected-row")).toHaveCount(1);
  expect(selected.selected).toBeTruthy();
  await page
    .getByRole("button", { name: "Показать маршрут", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        !!window.ng.getComponent(
          document.querySelector("app-tracker-workspace"),
        ).map.route,
    ),
  ).toBe(true);
  const camera = await page.evaluate(() => ({
    center: window.__mapsFake[0].center,
    zoom: window.__mapsFake[0].zoom,
    calls: window.__mapsFake[0].cameraCalls,
  }));
  await page.evaluate(() =>
    window.ng
      .getComponent(document.querySelector("app-tracker-workspace"))
      .vm.advance(),
  );
  expect(
    await page.evaluate(() => ({
      center: window.__mapsFake[0].center,
      zoom: window.__mapsFake[0].zoom,
      calls: window.__mapsFake[0].cameraCalls,
    })),
  ).toEqual(camera);
  expect(await page.evaluate(() => window.__mapsFake.length)).toBe(1);
  await page
    .locator(".events-panel")
    .getByRole("button", { name: "Время", exact: true })
    .click();
  const beforeEvent = await state(page);
  await eventRows(page).first().click();
  expect(
    await page.evaluate(
      () =>
        !!window.ng.getComponent(
          document.querySelector("app-tracker-workspace"),
        ).map.eventMarker,
    ),
  ).toBe(true);
  const e = await state(page);
  expect(e.trackers).toEqual(beforeEvent.trackers);
  expect(
    await page.evaluate(
      () =>
        window.ng.getComponent(document.querySelector("app-tracker-workspace"))
          .map.eventMarker._props.coordinates,
    ),
  ).toEqual(e.event.coordinates);
  await page
    .locator(".trackers-panel")
    .getByRole("button", { name: "Сбросить", exact: true })
    .click();
  await page.getByRole("button", { name: "Показать все найденные" }).click();
  await page
    .getByLabel("Поиск трекеров", { exact: true })
    .fill("Газель NEXT · 01");
  await rows(page).first().click();
  await page
    .locator(".trackers-panel")
    .getByRole("button", { name: "Сбросить", exact: true })
    .click();
  await page.getByRole("button", { name: "Увеличить масштаб" }).click();
  await page.getByRole("button", { name: "Увеличить масштаб" }).click();
  await page.locator(".gps-cluster").filter({ hasText: "3" }).first().click();
  await expect(
    page.getByText("Автомобили в этой точке", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".cluster-list>button")).toHaveCount(3);
  await page.locator(".cluster-list>button").nth(1).click();
  await expect(page.locator(".trackers-panel .selected-row")).toHaveCount(1);
});
test("Повторное создание/уничтожение и независимость двух экземпляров (SDK double)", async ({
  page,
}) => {
  await fake(page);
  await page.goto("/?harness&key=test-key");
  await expect(page.locator(".gps-cluster").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Второй экземпляр", exact: true })
    .click();
  await expect(page.locator("app-tracker-workspace")).toHaveCount(2);
  await page
    .getByLabel("Поиск трекеров", { exact: true })
    .nth(0)
    .fill("Газель");
  await expect(page.getByTestId("map-count").nth(1)).toContainText("80");
  await page.getByRole("switch", { name: "Имитация движения" }).nth(0).click();
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Создать / уничтожить", exact: true })
      .click();
    await expect(page.locator("app-tracker-workspace")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Создать / уничтожить", exact: true })
      .click();
    await expect(page.locator("app-tracker-workspace")).toHaveCount(2);
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__mapsFake.filter((m) => !m.destroyed).length,
        ),
      )
      .toBe(2);
  }
  const lifecycle = await page.evaluate(() =>
    window.__mapsFake.map((m) => ({
      destroyed: m.destroyed,
      listeners: m.listeners.size,
      children: m.children.length,
    })),
  );
  expect(lifecycle.filter((m) => m.destroyed).length).toBe(3);
  expect(
    lifecycle
      .filter((m) => m.destroyed)
      .every((m) => m.listeners === 0 && m.children === 0),
  ).toBe(true);
  await expect(
    page.getByRole("switch", { name: "Имитация движения" }).nth(0),
  ).not.toBeChecked();
});

test("Внешний SDK: ошибка загрузки с некорректным ключом", async ({ page }) => {
  const failures = [];
  page.on("requestfailed", (r) => {
    if (r.url().includes("api-maps.yandex.ru"))
      failures.push(r.failure()?.errorText);
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "gps-monitor-yandex-key",
      "invalid-key-for-gps-prototype-test",
    ),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Карта недоступна", exact: true }),
  ).toBeVisible({ timeout: 25000 });
  await test.info().attach("SDK network diagnostic", {
    body: JSON.stringify({ failures }),
    contentType: "application/json",
  });
  await expect(rows(page)).toHaveCount(10);
});

test("Уничтожение компонента во время загрузки SDK очищает загрузчик", async ({
  page,
}) => {
  await page.route("https://api-maps.yandex.ru/v3/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.abort();
  });
  await page.goto("/?harness&key=test-key");
  await expect(
    page.getByRole("heading", { name: "Подключаем карту…", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Создать / уничтожить", exact: true })
    .click();
  await expect(page.locator("app-tracker-workspace")).toHaveCount(0);
  expect(await page.locator('script[src*="api-maps.yandex.ru"]').count()).toBe(
    0,
  );
  await page.unroute("https://api-maps.yandex.ru/v3/**");
  await fake(page);
  await page
    .getByRole("button", { name: "Создать / уничтожить", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Увеличить масштаб", exact: true }),
  ).toBeVisible();
});

test("Кластеризация при изменении масштаба и обновление размеров карты (SDK double)", async ({
  page,
}) => {
  await fake(page);
  await page.goto("/");
  await expect(page.locator(".gps-cluster").first()).toBeVisible();
  await page
    .getByLabel("Подразделение", { exact: true })
    .selectOption("Центральный парк");
  await page.getByRole("button", { name: "Показать все найденные" }).click();
  for (let i = 0; i < 5; i++)
    await page
      .getByRole("button", { name: "Уменьшить масштаб", exact: true })
      .click();
  const low = await page.locator(".gps-marker").count();
  for (let i = 0; i < 5; i++)
    await page
      .getByRole("button", { name: "Увеличить масштаб", exact: true })
      .click();
  await expect
    .poll(() => page.locator(".gps-marker").count())
    .toBeGreaterThan(low);
  const before = await page.evaluate(() => window.__mapsFake[0].size);
  await page
    .getByRole("separator", { name: "Ширина колонок таблиц и карты" })
    .press("ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.__mapsFake[0].size.x))
    .toBeLessThan(before.x);
  expect(await page.evaluate(() => window.__mapsFake.length)).toBe(1);
});

test("Размер страницы, липкий заголовок, детерминированные данные", async ({
  page,
}) => {
  await page.goto("/?harness");
  const initial = await state(page);
  expect(initial.trackers).toHaveLength(80);
  expect(initial.events).toHaveLength(300);
  for (const t of initial.trackers) {
    expect(t.history.at(-1).coordinates).toEqual(t.coordinates);
    if (t.status !== "moving") expect(t.speed).toBe(0);
    if (t.status === "offline")
      expect(1790848800000 - t.lastMessage).toBeGreaterThanOrEqual(45 * 60000);
  }
  for (const e of initial.events) {
    const t = initial.trackers.find((t) => t.id === e.trackerId);
    expect(
      t.history.some(
        (p) =>
          p.time === e.time &&
          p.coordinates[0] === e.coordinates[0] &&
          p.coordinates[1] === e.coordinates[1],
      ),
    ).toBe(true);
  }
  await page.getByLabel("Страницы трекеров").getByRole("combobox").click();
  await page.getByRole("option", { name: "20", exact: true }).click();
  await expect(rows(page)).toHaveCount(20);
  const heading = page.locator(".trackers-panel th").first();
  const before = await heading.boundingBox();
  await page
    .locator(".trackers-panel .table-scroll")
    .evaluate((e) => (e.scrollTop = 300));
  const after = await heading.boundingBox();
  expect(Math.abs(before.y - after.y)).toBeLessThan(2);
  await page.getByLabel("Страницы событий").getByRole("combobox").click();
  await page.getByRole("option", { name: "5", exact: true }).click();
  await expect(eventRows(page)).toHaveCount(5);
  await page
    .getByRole("button", { name: "Создать / уничтожить", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Создать / уничтожить", exact: true })
    .click();
  expect((await state(page)).trackers).toEqual(initial.trackers);
});

test("Настройка ключа объясняет обязательный HTTP Referer и сохраняет введённое значение", async ({
  page,
}) => {
  await page.route("https://api-maps.yandex.ru/v3/**", (r) =>
    r.fulfill({
      status: 403,
      contentType: "application/json",
      body: '{"message":"Invalid api key"}',
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Настроить подключение", exact: true })
    .click();
  await expect(page.locator(".map-settings")).toContainText(
    "Ограничение по HTTP Referer",
  );
  await page
    .getByLabel("Ключ Яндекс Карт", { exact: true })
    .fill("test-rejected-key");
  await page.getByRole("button", { name: "Подключить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Карта недоступна", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".map-placeholder")).toContainText("до 15 минут");
  await page
    .getByRole("button", { name: "Настроить подключение", exact: true })
    .click();
  await expect(
    page.getByLabel("Ключ Яндекс Карт", { exact: true }),
  ).toHaveValue("test-rejected-key");
});

test("SDK в глобальном lexical scope: повтор после таймаута не подключает скрипт заново", async ({
  page,
}) => {
  const fs = require("node:fs");
  let requests = 0;
  const body =
    fs
      .readFileSync(path.join(__dirname, "fake-yandex.js"), "utf8")
      .replace("window.ymaps3 =", "const ymaps3 =") +
    "\nymaps3.ready = new Promise(resolve => setTimeout(resolve, 21000));";
  await page.clock.install();
  await page.route("https://api-maps.yandex.ru/v3/**", (route) => {
    requests++;
    return route.fulfill({ body, contentType: "application/javascript" });
  });
  await page.addInitScript(() =>
    localStorage.setItem("gps-monitor-yandex-key", "test-key"),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Подключаем карту…", exact: true }),
  ).toBeVisible();
  await expect.poll(() => requests).toBe(1);
  await page.waitForFunction(() => typeof ymaps3 !== "undefined");
  await page.clock.fastForward(22000);
  await expect(
    page.getByRole("heading", { name: "Карта недоступна", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Увеличить масштаб", exact: true }),
  ).toBeVisible();
  expect(requests).toBe(1);
});
