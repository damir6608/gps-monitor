import { Component, signal } from "@angular/core";
import { TrackerWorkspaceComponent } from "./tracker-workspace/tracker-workspace.component";
import { createDemoData } from "./core/demo-data";
import { MapSettings } from "./core/models";
@Component({
  selector: "app-root",
  standalone: true,
  imports: [TrackerWorkspaceComponent],
  template: `<main class="demo-shell">
    <app-tracker-workspace
      [trackers]="demo.trackers"
      [events]="demo.events"
      [mapSettings]="settings()"
      (mapKeyChange)="saveKey($event)"
    />
  </main>`,
  styles: [
    `
      :host {
        display: block;
      }
      .demo-shell {
        height: 100dvh;
        min-height: 480px;
      }
    `,
  ],
})
export class AppComponent {
  readonly demo = createDemoData();
  readonly settings = signal<MapSettings>({ apiKey: "" });
  constructor() {
    const key = localStorage.getItem("gps-monitor-yandex-key");
    if (key) this.settings.set({ apiKey: key });
    else
      void fetch("config.json")
        .then((r) => r.json())
        .then((config: { yandexApiKey?: string }) => {
          if (config.yandexApiKey && !this.settings().apiKey)
            this.settings.set({ apiKey: config.yandexApiKey });
        })
        .catch(() => {});
  }
  saveKey(apiKey: string) {
    localStorage.setItem("gps-monitor-yandex-key", apiKey);
    this.settings.set({ apiKey });
  }
}
