export type FillSeriesKind = "date_day" | "number" | "text_repeat";

export type FillSeriesResult =
  | { ok: true; kind: FillSeriesKind; values: string[] }
  | { ok: false; error: string };

const DATE_PATTERN = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$/;

export function detectFillSeries(seed: string, count: number): FillSeriesResult {
  if (count <= 0) return { ok: false, error: "invalid_count" };
  const trimmed = seed.trim();
  if (!trimmed) return { ok: false, error: "empty_seed" };

  const dateMatch = DATE_PATTERN.exec(trimmed);
  if (dateMatch) {
    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const year = dateMatch[3] ? normalizeYear(Number(dateMatch[3])) : new Date().getFullYear();
    const values: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const date = new Date(year, month - 1, day + index);
      values.push(
        `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`
      );
    }
    return { ok: true, kind: "date_day", values };
  }

  const numberValue = Number(trimmed.replace(",", "."));
  if (Number.isFinite(numberValue)) {
    const values = Array.from({ length: count }, (_, index) => String(numberValue + index));
    return { ok: true, kind: "number", values };
  }

  return {
    ok: true,
    kind: "text_repeat",
    values: Array.from({ length: count }, () => trimmed)
  };
}

function normalizeYear(value: number): number {
  if (value < 100) return 2000 + value;
  return value;
}
