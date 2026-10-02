import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
} from "@angular/core";
import { Sort } from "@angular/material/sort";
import { PageEvent } from "@angular/material/paginator";
import {
  Coordinates,
  EVENT_TYPE,
  EventType,
  Severity,
  Tracker,
  TrackerEvent,
  TrackerStatus,
} from "../../core/models";

@Injectable()
export class WorkspaceState {
  readonly trackers = signal<Tracker[]>([]);
  readonly events = signal<TrackerEvent[]>([]);
  readonly query = signal("");
  readonly status = signal<TrackerStatus | "">("");
  readonly group = signal("");
  readonly eventQuery = signal("");
  readonly eventType = signal<EventType | "">("");
  readonly severity = signal<Severity | "">("");
  readonly onlySelected = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly selectedEvent = signal<TrackerEvent | null>(null);
  readonly routeVisible = signal(false);
  readonly simulating = signal(false);
  readonly trackerPage = signal(0);
  readonly trackerSize = signal(10);
  readonly eventPage = signal(0);
  readonly eventSize = signal(10);
  readonly trackerSort = signal<Sort>({ active: "name", direction: "asc" });
  readonly eventSort = signal<Sort>({ active: "time", direction: "desc" });
  readonly cameraCommand = signal<{
    coordinates: Coordinates;
    sequence: number;
  } | null>(null);
  readonly groups = computed(() =>
    [...new Set(this.trackers().map((t) => t.group))].sort(),
  );
  readonly trackerById = computed(
    () => new Map(this.trackers().map((t) => [t.id, t])),
  );
  readonly filtered = computed(() => {
    const q = this.query().trim().toLocaleLowerCase("ru");
    return this.trackers().filter(
      (t) =>
        (!this.status() || t.status === this.status()) &&
        (!this.group() || t.group === this.group()) &&
        (!q ||
          `${t.name} ${t.plate} ${t.driver}`
            .toLocaleLowerCase("ru")
            .includes(q)),
    );
  });
  readonly sortedTrackers = computed(() =>
    sortRows(this.filtered(), this.trackerSort(), (t) => t),
  );
  readonly trackerRows = computed(() =>
    this.sortedTrackers().slice(
      this.trackerPage() * this.trackerSize(),
      (this.trackerPage() + 1) * this.trackerSize(),
    ),
  );
  readonly selected = computed(
    () => this.trackerById().get(this.selectedId() ?? "") ?? null,
  );
  readonly filteredEvents = computed(() => {
    const ids = new Set(this.filtered().map((t) => t.id));
    const q = this.eventQuery().trim().toLocaleLowerCase("ru");
    return this.events().filter(
      (e) =>
        ids.has(e.trackerId) &&
        (!this.onlySelected() || e.trackerId === this.selectedId()) &&
        (!this.eventType() || e.type === this.eventType()) &&
        (!this.severity() || e.severity === this.severity()) &&
        (!q ||
          `${e.description} ${EVENT_TYPE[e.type]} ${this.trackerById().get(e.trackerId)?.name} ${this.trackerById().get(e.trackerId)?.plate}`
            .toLocaleLowerCase("ru")
            .includes(q)),
    );
  });
  readonly sortedEvents = computed(() =>
    sortRows(this.filteredEvents(), this.eventSort(), (e) => ({
      ...e,
      vehicle: this.trackerById().get(e.trackerId)?.name ?? "",
      type: EVENT_TYPE[e.type],
    })),
  );
  readonly eventRows = computed(() =>
    this.sortedEvents().slice(
      this.eventPage() * this.eventSize(),
      (this.eventPage() + 1) * this.eventSize(),
    ),
  );
  readonly recentEvents = computed(() =>
    this.events()
      .filter((e) => e.trackerId === this.selectedId())
      .sort((a, b) => b.time - a.time)
      .slice(0, 4),
  );
  readonly counts = computed(() => ({
    moving: this.trackers().filter((t) => t.status === "moving").length,
    parked: this.trackers().filter((t) => t.status === "parked").length,
    offline: this.trackers().filter((t) => t.status === "offline").length,
  }));
  private originalTrackers: Tracker[] = [];
  private originalEvents: TrackerEvent[] = [];
  private tick = 0;
  private sequence = 0;
  private timer?: ReturnType<typeof setInterval>;
  constructor() {
    effect(() => {
      if (
        this.selectedId() &&
        !this.filtered().some((t) => t.id === this.selectedId())
      )
        this.clearSelection();
    });
    effect(() => {
      this.trackerPage.update((p) =>
        Math.min(
          p,
          Math.max(
            0,
            Math.ceil(this.filtered().length / this.trackerSize()) - 1,
          ),
        ),
      );
    });
    effect(() => {
      this.eventPage.update((p) =>
        Math.min(
          p,
          Math.max(
            0,
            Math.ceil(this.filteredEvents().length / this.eventSize()) - 1,
          ),
        ),
      );
    });
    effect(() => {
      if (this.simulating())
        this.timer = setInterval(() => this.advance(), 3000);
      else this.stopTimer();
    });
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }
  setData(trackers: readonly Tracker[], events: readonly TrackerEvent[]) {
    this.originalTrackers = structuredClone([...trackers]);
    this.originalEvents = structuredClone([...events]);
    this.trackers.set(structuredClone(this.originalTrackers));
    this.events.set(structuredClone(this.originalEvents));
    this.tick = 0;
  }
  filtersChanged() {
    this.trackerPage.set(0);
    this.eventPage.set(0);
  }
  resetFilters() {
    this.query.set("");
    this.status.set("");
    this.group.set("");
    this.filtersChanged();
  }
  resetEventFilters() {
    this.eventQuery.set("");
    this.eventType.set("");
    this.severity.set("");
    this.onlySelected.set(false);
    this.eventPage.set(0);
  }
  page(event: PageEvent, table: "trackers" | "events") {
    if (table === "trackers") {
      this.trackerSize.set(event.pageSize);
      this.trackerPage.set(event.pageIndex);
    } else {
      this.eventSize.set(event.pageSize);
      this.eventPage.set(event.pageIndex);
    }
  }
  select(id: string, coordinates?: Coordinates, event?: TrackerEvent) {
    const tracker = this.trackerById().get(id);
    if (!tracker) return;
    if (this.selectedId() !== id) this.routeVisible.set(false);
    this.selectedId.set(id);
    this.selectedEvent.set(event ?? null);
    const index = this.sortedTrackers().findIndex((t) => t.id === id);
    if (index >= 0)
      this.trackerPage.set(Math.floor(index / this.trackerSize()));
    this.cameraCommand.set({
      coordinates: coordinates ?? tracker.coordinates,
      sequence: ++this.sequence,
    });
  }
  selectEvent(event: TrackerEvent) {
    this.select(event.trackerId, event.coordinates, event);
  }
  clearSelection() {
    this.selectedId.set(null);
    this.selectedEvent.set(null);
    this.routeVisible.set(false);
  }
  resetDemo() {
    this.simulating.set(false);
    this.stopTimer();
    this.trackers.set(structuredClone(this.originalTrackers));
    this.events.set(structuredClone(this.originalEvents));
    this.tick = 0;
    this.clearSelection();
    this.resetFilters();
    this.resetEventFilters();
    this.trackerSort.set({ active: "name", direction: "asc" });
    this.eventSort.set({ active: "time", direction: "desc" });
  }
  advance() {
    const now = Date.now();
    const tick = this.tick++;
    const added: TrackerEvent[] = [];
    this.trackers.update((rows) =>
      rows.map((t, i) => {
        if (i % 8 !== tick % 8 || t.status !== "moving") return t;
        const coordinates: Coordinates = [
          t.coordinates[0] + 0.00028,
          t.coordinates[1] + 0.0001,
        ];
        const speed = 28 + ((i + tick) % 30);
        added.push({
          id: `sim-${tick}-${t.id}`,
          trackerId: t.id,
          time: now,
          type: "start",
          severity: "info",
          description: `Движение по маршруту, ${speed} км/ч. Плановое сообщение.`,
          coordinates,
        });
        return {
          ...t,
          coordinates,
          speed,
          lastMessage: now,
          history: [...t.history, { coordinates, speed, time: now }].slice(-60),
        };
      }),
    );
    this.events.update((rows) => [...added, ...rows].slice(0, 600));
  }
  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
function sortRows<T>(rows: T[], sort: Sort, values: (row: T) => object): T[] {
  if (!sort.direction) return [...rows];
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = (values(a) as Record<string, unknown>)[sort.active];
    const y = (values(b) as Record<string, unknown>)[sort.active];
    return (
      direction *
      (typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x ?? "").localeCompare(String(y ?? ""), "ru", {
            numeric: true,
          }))
    );
  });
}
