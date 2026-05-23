export function parseMonthIso(value: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const [, monthText] = value.split("-");
  const month = Number.parseInt(monthText ?? "", 10);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  return value;
}

export function currentMonthIso(): string {
  const now = new Date();
  return toMonthIso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
}

export function toMonthIso(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export function shiftMonth(monthIso: string, delta: number): string {
  const parsed = parseMonthIso(monthIso);
  if (!parsed) return currentMonthIso();
  const [yearText, monthText] = parsed.split("-");
  const year = Number.parseInt(yearText ?? "", 10);
  const monthIndex = Number.parseInt(monthText ?? "", 10) - 1;
  const date = new Date(Date.UTC(year, monthIndex + delta, 1));
  return toMonthIso(date);
}

export function monthIsoToDateRange(monthIso: string): { fromDate: string; toDate: string } {
  const parsed = parseMonthIso(monthIso) ?? currentMonthIso();
  const [yearText, monthText] = parsed.split("-");
  const year = Number.parseInt(yearText ?? "", 10);
  const monthIndex = Number.parseInt(monthText ?? "", 10) - 1;
  const monthPart = String(monthIndex + 1).padStart(2, "0");
  const fromDate = `${year}-${monthPart}-01`;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const toDate = `${year}-${monthPart}-${String(lastDay).padStart(2, "0")}`;
  return { fromDate, toDate };
}
