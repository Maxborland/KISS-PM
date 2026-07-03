/** Человекочитаемые подписи для технических ключей демо (не показывать сырой код в UI). */

const PERMISSION_LABELS: Record<string, string> = {
  "portfolio.scenario.apply": "Применение сценария к портфелю",
  "audit.write": "Запись в журнал аудита",
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  "portfolio.scenario.apply": "Применить сценарий портфеля",
};

export function labelPermission(key: string): string {
  return PERMISSION_LABELS[key] ?? key;
}

export function labelActionType(key: string): string {
  return ACTION_TYPE_LABELS[key] ?? key;
}

export function formatAuditEntry(entry: string): string {
  return entry.startsWith("#") ? `№ ${entry.slice(1)}` : entry;
}
