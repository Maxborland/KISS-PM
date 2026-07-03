import type { LandingLocale } from "../lib/landing-i18n";

const PERMISSION_LABELS: Record<LandingLocale, Record<string, string>> = {
  ru: {
    "portfolio.scenario.apply": "Применение сценария к портфелю",
    "audit.write": "Запись в журнал аудита",
  },
  en: {
    "portfolio.scenario.apply": "Apply scenario to portfolio",
    "audit.write": "Write audit record",
  },
};

const ACTION_TYPE_LABELS: Record<LandingLocale, Record<string, string>> = {
  ru: {
    "portfolio.scenario.apply": "Применить сценарий портфеля",
  },
  en: {
    "portfolio.scenario.apply": "Apply portfolio scenario",
  },
};

export function labelPermission(key: string, locale: LandingLocale = "ru"): string {
  return PERMISSION_LABELS[locale][key] ?? key;
}

export function labelActionType(key: string, locale: LandingLocale = "ru"): string {
  return ACTION_TYPE_LABELS[locale][key] ?? key;
}

export function formatAuditEntry(entry: string, locale: LandingLocale = "ru"): string {
  if (locale === "en") return entry;
  return entry.startsWith("#") ? `№ ${entry.slice(1)}` : entry;
}