import { bootstrapApplication } from "@angular/platform-browser";
import { isDevMode, LOCALE_ID } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import ru from "@angular/common/locales/ru";
import { AppComponent } from "./app/app";
registerLocaleData(ru);
const component =
  isDevMode() && new URLSearchParams(location.search).has("harness")
    ? import("./testing/harness").then((m) => m.HarnessComponent)
    : Promise.resolve(AppComponent);
void component
  .then((root) =>
    bootstrapApplication(root, {
      providers: [{ provide: LOCALE_ID, useValue: "ru" }],
    }),
  )
  .catch(console.error);
