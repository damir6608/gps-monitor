import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { DatePipe, DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatTableModule } from "@angular/material/table";
import { MatSortModule } from "@angular/material/sort";
import {
  MatPaginatorIntl,
  MatPaginatorModule,
} from "@angular/material/paginator";
import { MatButtonModule } from "@angular/material/button";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import {
  EVENT_TYPE,
  EventType,
  Severity,
  TrackerStatus,
  MapSettings,
  SEVERITY,
  STATUS,
  STATUS_ICON,
  Tracker,
  TrackerEvent,
} from "../core/models";
import { WorkspaceState } from "./services/workspace-state";
import { YandexMapAdapter } from "./services/yandex-map-adapter";
import { SplitterDirective } from "./splitter.directive";
function paginatorRu() {
  const intl = new MatPaginatorIntl();
  intl.itemsPerPageLabel = "Строк:";
  intl.nextPageLabel = "Следующая страница";
  intl.previousPageLabel = "Предыдущая страница";
  intl.firstPageLabel = "Первая страница";
  intl.lastPageLabel = "Последняя страница";
  intl.getRangeLabel = (page, size, length) =>
    length
      ? `${page * size + 1}–${Math.min((page + 1) * size, length)} из ${length}`
      : "0 из 0";
  return intl;
}
@Component({
  selector: "app-tracker-workspace",
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatButtonModule,
    MatSlideToggleModule,
    SplitterDirective,
  ],
  providers: [
    WorkspaceState,
    YandexMapAdapter,
    { provide: MatPaginatorIntl, useFactory: paginatorRu },
  ],
  templateUrl: "./tracker-workspace.component.html",
  styleUrl: "./tracker-workspace.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tracker-workspace" },
})
export class TrackerWorkspaceComponent implements OnDestroy {
  readonly trackers = input<readonly Tracker[]>([]);
  readonly events = input<readonly TrackerEvent[]>([]);
  readonly mapSettings = input<MapSettings>({ apiKey: "" });
  readonly selectedTrackerChange = output<Tracker | null>();
  readonly mapKeyChange = output<string>();
  readonly vm = inject(WorkspaceState);
  readonly map = inject(YandexMapAdapter);
  readonly statuses = STATUS;
  readonly statusIcons = STATUS_ICON;
  readonly eventTypes = EVENT_TYPE;
  readonly severities = SEVERITY;
  readonly statusKeys = Object.keys(STATUS) as (keyof typeof STATUS)[];
  readonly typeKeys = Object.keys(EVENT_TYPE) as (keyof typeof EVENT_TYPE)[];
  readonly severityKeys = Object.keys(SEVERITY) as (keyof typeof SEVERITY)[];
  readonly trackerColumns = ["name", "status", "speed", "battery"];
  readonly eventColumns = [
    "time",
    "vehicle",
    "type",
    "severity",
    "description",
  ];
  readonly columnSplit = signal(45);
  readonly leftSplit = signal(60);
  readonly rightSplit = signal(60);
  readonly keyDraft = signal("");
  readonly settingsOpen = signal(false);
  private readonly mapHost =
    viewChild.required<ElementRef<HTMLElement>>("mapHost");
  private readonly mounted = signal(false);
  readonly speedLine = computed(
    () =>
      this.vm
        .selected()
        ?.history.map(
          (p, i, a) =>
            `${(i / Math.max(1, a.length - 1)) * 400},${70 - (p.speed / 110) * 60}`,
        )
        .join(" ") ?? "",
  );
  constructor() {
    effect(() => this.vm.setData(this.trackers(), this.events()));
    effect(() => this.selectedTrackerChange.emit(this.vm.selected()));
    afterNextRender(() => this.mounted.set(true));
    effect(() => {
      const settings = this.mapSettings();
      if (this.mounted())
        void this.map.mount(this.mapHost().nativeElement, settings, (id) =>
          this.vm.select(id),
        );
    });
    effect(() => {
      this.map.state();
      this.map.update(this.vm.filtered(), this.vm.selectedId());
    });
    effect(() => {
      const ready = this.map.state() === "ready";
      const command = this.vm.cameraCommand();
      if (ready && command) this.map.center(command.coordinates);
    });
    effect(() => {
      this.map.state();
      this.map.setRoute(this.vm.selected(), this.vm.routeVisible());
    });
    effect(() => {
      this.map.state();
      this.map.setEvent(this.vm.selectedEvent());
    });
  }
  statusLabel(value: TrackerStatus) {
    return STATUS[value];
  }
  statusIcon(value: TrackerStatus) {
    return STATUS_ICON[value];
  }
  eventLabel(value: EventType) {
    return EVENT_TYPE[value];
  }
  severityLabel(value: Severity) {
    return SEVERITY[value];
  }
  fitAll() {
    this.map.fit(this.vm.filtered().map((t) => t.coordinates));
  }
  focusSelected() {
    const tracker = this.vm.selected();
    if (tracker) this.map.center(tracker.coordinates);
  }
  toggleRoute() {
    this.vm.routeVisible.update((v) => !v);
    const tracker = this.vm.selected();
    if (this.vm.routeVisible() && tracker)
      this.map.fit(tracker.history.map((p) => p.coordinates));
  }
  resetLayout() {
    this.columnSplit.set(45);
    this.leftSplit.set(60);
    this.rightSplit.set(60);
  }
  openMapSettings() {
    this.keyDraft.set(this.mapSettings().apiKey);
    this.settingsOpen.set(true);
  }
  applyKey() {
    this.mapKeyChange.emit(this.keyDraft().trim());
    this.settingsOpen.set(false);
  }
  retry() {
    void this.map.mount(
      this.mapHost().nativeElement,
      this.mapSettings(),
      (id) => this.vm.select(id),
    );
  }
  ngOnDestroy() {
    this.map.destroy();
  }
}
