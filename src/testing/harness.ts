import { Component, signal } from "@angular/core";
import { TrackerWorkspaceComponent } from "../app/tracker-workspace/tracker-workspace.component";
import { createDemoData } from "../app/core/demo-data";
@Component({
  selector: "app-root",
  imports: [TrackerWorkspaceComponent],
  template: `<button (click)="visible.set(!visible())">
      Создать / уничтожить</button
    ><button (click)="two.set(!two())">Второй экземпляр</button>
    @if (visible()) {
      <div style="height:800px">
        <app-tracker-workspace
          [trackers]="data.trackers"
          [events]="data.events"
          [mapSettings]="settings"
        />
      </div>
    }
    @if (two()) {
      <div style="height:800px">
        <app-tracker-workspace
          [trackers]="data.trackers"
          [events]="data.events"
          [mapSettings]="settings"
        />
      </div>
    }`,
})
export class HarnessComponent {
  readonly data = createDemoData(1790848800000);
  readonly visible = signal(true);
  readonly two = signal(false);
  readonly settings = {
    apiKey: new URLSearchParams(location.search).get("key") ?? "",
  };
}
