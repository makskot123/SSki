import en from "./messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof import("./i18n/routing").routing.locales)[number];
    Messages: typeof en;
  }
}
