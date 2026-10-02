import { Injectable, signal } from "@angular/core";
import type { YMap, YMapFeature, YMapMarker } from "@yandex/ymaps3-types";
import type { Feature, YMapClusterer } from "@yandex/ymaps3-clusterer";
import {
  Coordinates,
  MapSettings,
  STATUS,
  STATUS_ICON,
  Tracker,
  TrackerEvent,
} from "../../core/models";

type Api = typeof import("@yandex/ymaps3-types");
let sdkPromise: Promise<Api> | undefined;
let sdkKey = "";
let sdkUsers = 0;
let lastRequestedKey = "";
function existingSdk(): Api | undefined {
  return typeof ymaps3 === "undefined" ? undefined : ymaps3;
}
let cancelSdkLoad: (() => void) | undefined;
/** The SDK is shared; each adapter exclusively owns its map, entities and listeners. */
function loadSdk(key: string): Promise<Api> {
  if (sdkPromise) {
    if (sdkKey !== key)
      return Promise.reject(
        new Error(
          "Ключ изменён. Перезагрузите страницу для подключения нового ключа.",
        ),
      );
    return sdkPromise;
  }
  const existing = existingSdk();
  if (existing && lastRequestedKey && lastRequestedKey !== key) {
    return Promise.reject(
      new Error(
        "SDK уже загружен с другим ключом. Перезагрузите страницу после сохранения нового ключа.",
      ),
    );
  }
  lastRequestedKey = key;
  sdkKey = key;
  sdkPromise = new Promise<Api>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
    script.async = true;
    script.referrerPolicy = "strict-origin-when-cross-origin";
    let settled = false;
    const timer = setTimeout(
      () =>
        fail(
          "Яндекс Карты не ответили за 20 секунд. Проверьте подключение к сети и повторите попытку.",
        ),
      20000,
    );
    const fail = (
      message = "Не удалось загрузить JavaScript API v3. Проверьте тип и активацию ключа, обязательное ограничение HTTP Referer для текущего домена и доступ к api-maps.yandex.ru. Изменения ключа могут применяться до 15 минут.",
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      script.remove();
      cancelSdkLoad = undefined;
      sdkPromise = undefined;
      sdkKey = "";
      reject(new Error(message));
    };
    cancelSdkLoad = fail;
    script.onerror = () => fail();
    const waitForSdk = () => {
      const api = existingSdk();
      if (!api) {
        fail();
        return;
      }
      api.ready.then(
        () => {
          if (settled) return;
          settled = true;
          cancelSdkLoad = undefined;
          clearTimeout(timer);
          script.onload = null;
          script.onerror = null;
          resolve(api);
        },
        () => fail(),
      );
    };
    script.onload = waitForSdk;
    // A timeout or component teardown can leave an initialized global SDK.
    // Reuse it; executing the loader twice throws "ymaps3: already defined".
    if (existing) waitForSdk();
    else document.head.appendChild(script);
  });
  return sdkPromise;
}
@Injectable()
export class YandexMapAdapter {
  readonly state = signal<"missing" | "loading" | "ready" | "error">("missing");
  readonly error = signal("");
  readonly clusterTrackers = signal<Tracker[]>([]);
  readonly objectCount = signal(0);
  private map?: YMap;
  private api?: Api;
  private clusterer?: YMapClusterer;
  private route?: YMapFeature;
  private eventMarker?: YMapMarker;
  private sdkLease = false;
  private generation = 0;
  private eventTimer?: ReturnType<typeof setTimeout>;
  private trackers: Tracker[] = [];
  private selectedId: string | null = null;
  private select: (id: string) => void = () => {};
  async mount(
    host: HTMLElement,
    settings: MapSettings,
    select: (id: string) => void,
  ) {
    this.destroy();
    const generation = this.generation;
    this.select = select;
    if (!settings.apiKey.trim()) {
      this.state.set("missing");
      return;
    }
    this.state.set("loading");
    this.error.set("");
    try {
      ++sdkUsers;
      this.sdkLease = true;
      const api = await loadSdk(settings.apiKey.trim());
      if (generation !== this.generation) return;
      // Import only AFTER ymaps3.ready: the official package extends vanilla SDK entities.
      const { YMapClusterer, clusterByGrid } = await import(
        "@yandex/ymaps3-clusterer"
      );
      if (generation !== this.generation) return;
      this.api = api;
      this.map = new api.YMap(host, {
        location: {
          center: settings.center ?? [37.6, 55.75],
          zoom: settings.zoom ?? 9,
        },
        mode: "vector",
      });
      this.map
        .addChild(new api.YMapDefaultSchemeLayer({}))
        .addChild(new api.YMapDefaultFeaturesLayer({}));
      this.clusterer = new YMapClusterer({
        method: clusterByGrid({ gridSize: 64 }),
        tickTimeout: 0,
        features: [],
        marker: (feature) => this.marker(feature),
        cluster: (coordinates, features) => {
          const button = this.button(
            String(features.length),
            "gps-cluster",
            `Группа: ${features.length} автомобилей`,
          );
          button.onclick = () => {
            const ids = new Set(features.map((f) => String(f.id)));
            const rows = this.trackers.filter((t) => ids.has(t.id));
            const same = rows.every(
              (t) =>
                Math.abs(t.coordinates[0] - coordinates[0]) < 0.00001 &&
                Math.abs(t.coordinates[1] - coordinates[1]) < 0.00001,
            );
            if (same || (this.map?.zoom ?? 0) >= 18)
              this.clusterTrackers.set(rows);
            else this.fit(rows.map((t) => t.coordinates));
          };
          return new api.YMapMarker({ coordinates }, button);
        },
      });
      this.map.addChild(this.clusterer);
      this.state.set("ready");
      this.update(this.trackers, this.selectedId);
      // YMap v3 owns a ResizeObserver; it handles parent/splitter resizing without reconstruction.
    } catch (error) {
      if (generation !== this.generation) return;
      this.destroy();
      this.error.set(
        error instanceof Error ? error.message : "Ошибка подключения карты",
      );
      this.state.set("error");
    }
  }
  update(trackers: Tracker[], selectedId: string | null) {
    this.trackers = trackers;
    this.selectedId = selectedId;
    this.objectCount.set(trackers.length);
    const ids = new Set(trackers.map((t) => t.id));
    this.clusterTrackers.update((rows) => rows.filter((t) => ids.has(t.id)));
    // 0.0.12 caches entities by ID. Reattach the clusterer to invalidate stale marker DOM; the map and camera stay intact.
    if (this.map && this.clusterer) this.map.removeChild(this.clusterer);
    this.clusterer?.update({
      features: trackers.map((t) => ({
        type: "Feature",
        id: t.id,
        geometry: { type: "Point", coordinates: t.coordinates },
        properties: { ...t, selected: t.id === selectedId },
      })),
      marker: (feature) => this.marker(feature),
    });
    if (this.map && this.clusterer) this.map.addChild(this.clusterer);
  }
  private marker(feature: Feature) {
    const t = this.trackers.find((t) => t.id === String(feature.id))!;
    const button = this.button(
      STATUS_ICON[t.status],
      `gps-marker ${t.status}${t.id === this.selectedId ? " selected" : ""}`,
      `${t.name}, ${t.plate}, ${STATUS[t.status]}`,
    );
    button.onclick = () => {
      this.clusterTrackers.set([]);
      this.select(t.id);
    };
    return new this.api!.YMapMarker(
      {
        coordinates: feature.geometry.coordinates,
        zIndex: t.id === this.selectedId ? 2000 : 100,
      },
      button,
    );
  }
  private button(text: string, className: string, label: string) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = className;
    element.textContent = text;
    element.title = label;
    element.setAttribute("aria-label", label);
    return element;
  }
  center(coordinates: Coordinates) {
    this.map?.setLocation({
      center: coordinates,
      zoom: Math.max(this.map.zoom, 14),
      duration: 350,
    });
  }
  zoom(delta: number) {
    if (this.map)
      this.map.setLocation({
        zoom: Math.max(3, Math.min(21, this.map.zoom + delta)),
        duration: 250,
      });
  }
  fit(points: Coordinates[]) {
    if (!this.map || !points.length) return;
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    if (maxX - minX < 0.0001 && maxY - minY < 0.0001) {
      this.center(points[0]);
      return;
    }
    const dx = Math.max(0.002, (maxX - minX) * 0.15),
      dy = Math.max(0.002, (maxY - minY) * 0.15);
    this.map.setLocation({
      bounds: [
        [minX - dx, minY - dy],
        [maxX + dx, maxY + dy],
      ],
      duration: 400,
    });
  }
  setRoute(tracker: Tracker | null, visible: boolean) {
    if (this.route && this.map) this.map.removeChild(this.route);
    this.route = undefined;
    if (
      this.map &&
      this.api &&
      tracker &&
      visible &&
      tracker.history.length > 1
    ) {
      this.route = new this.api.YMapFeature({
        geometry: {
          type: "LineString",
          coordinates: tracker.history.map((p) => p.coordinates),
        },
        style: { stroke: [{ color: "#5865dd", width: 5, opacity: 0.8 }] },
      });
      this.map.addChild(this.route);
    }
  }
  setEvent(event: TrackerEvent | null) {
    this.removeEvent();
    if (this.map && this.api && event) {
      const node = this.button("!", "gps-event-marker", "Выбранное событие");
      this.eventMarker = new this.api.YMapMarker(
        { coordinates: event.coordinates, zIndex: 3000 },
        node,
      );
      this.map.addChild(this.eventMarker);
      this.eventTimer = setTimeout(() => this.removeEvent(), 30000);
    }
  }
  private removeEvent() {
    if (this.eventTimer) clearTimeout(this.eventTimer);
    this.eventTimer = undefined;
    if (this.map && this.eventMarker) this.map.removeChild(this.eventMarker);
    this.eventMarker = undefined;
  }
  destroy() {
    ++this.generation;
    this.removeEvent();
    this.map?.destroy();
    this.map = undefined;
    this.api = undefined;
    this.clusterer = undefined;
    this.route = undefined;
    this.clusterTrackers.set([]);
    if (this.sdkLease) {
      this.sdkLease = false;
      --sdkUsers;
      if (sdkUsers === 0) cancelSdkLoad?.();
    }
  }
}
