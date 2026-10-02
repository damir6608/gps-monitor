import {
  Directive,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

@Directive({
  selector: "[workspaceSplitter]",
  host: {
    role: "separator",
    tabindex: "0",
    "[attr.aria-orientation]": "orientation()",
    "[attr.aria-valuenow]": "value()",
    "aria-valuemin": "20",
    "aria-valuemax": "80",
    "(pointerdown)": "start($event)",
    "(pointermove)": "move($event)",
    "(pointerup)": "end($event)",
    "(pointercancel)": "end($event)",
    "(keydown)": "key($event)",
  },
})
export class SplitterDirective {
  readonly orientation = input<"vertical" | "horizontal">("vertical");
  readonly value = input(45);
  readonly valueChange = output<number>();
  private element = inject<ElementRef<HTMLElement>>(ElementRef);
  private dragging = signal(false);
  start(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    this.element.nativeElement.focus();
    this.element.nativeElement.setPointerCapture(event.pointerId);
    this.dragging.set(true);
  }
  move(event: PointerEvent) {
    if (!this.dragging()) return;
    const rect =
      this.element.nativeElement.parentElement!.getBoundingClientRect();
    const vertical = this.orientation() === "vertical";
    const size = vertical ? rect.width : rect.height;
    const offset = vertical
      ? event.clientX - rect.left
      : event.clientY - rect.top;
    this.emit((offset / size) * 100);
  }
  end(event: PointerEvent) {
    this.dragging.set(false);
    if (this.element.nativeElement.hasPointerCapture(event.pointerId))
      this.element.nativeElement.releasePointerCapture(event.pointerId);
  }
  key(event: KeyboardEvent) {
    const minus = this.orientation() === "vertical" ? "ArrowLeft" : "ArrowUp";
    const plus = this.orientation() === "vertical" ? "ArrowRight" : "ArrowDown";
    if (event.key === minus || event.key === plus) {
      event.preventDefault();
      this.emit(
        this.value() +
          (event.key === plus ? 1 : -1) * (event.shiftKey ? 10 : 2),
      );
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      this.emit(event.key === "Home" ? 20 : 80);
    }
  }
  private emit(value: number) {
    const rect =
      this.element.nativeElement.parentElement!.getBoundingClientRect();
    const size = this.orientation() === "vertical" ? rect.width : rect.height;
    const minimum = this.orientation() === "vertical" ? 320 : 210;
    const lower = Math.min(50, Math.max(20, (minimum / size) * 100));
    this.valueChange.emit(Math.max(lower, Math.min(100 - lower, value)));
  }
}
