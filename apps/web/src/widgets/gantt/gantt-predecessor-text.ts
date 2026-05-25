import type { GanttDependency, GanttDependencyType, GanttRow } from "./types";

const TOKEN_RE = /^(\d+)\s*(FS|SS|FF|SF)?\s*([+-]\d+)\s*d?$/i;

export type ParsedPredecessorToken = {
  rowNumber: number;
  type: GanttDependencyType;
  lagDays: number;
};

export function formatPredecessorText(
  rowNumber: number,
  type: GanttDependencyType = "FS",
  lagDays = 0
): string {
  const typeSuffix = type === "FS" ? "" : type;
  const lagSuffix =
    lagDays !== 0 ? `${lagDays > 0 ? "+" : ""}${lagDays}d` : "";
  return `${rowNumber}${typeSuffix}${lagSuffix}`;
}

export function parsePredecessorText(text: string): ParsedPredecessorToken[] {
  const raw = text.trim();
  if (!raw || raw === "—") return [];

  const tokens: ParsedPredecessorToken[] = [];
  for (const part of raw.split(/[,;]\s*/)) {
    const chunk = part.trim();
    if (!chunk) continue;
    const match = TOKEN_RE.exec(chunk.replace(/\s+/g, ""));
    if (!match) continue;
    const rowNumber = Number(match[1]);
    const type = (match[2]?.toUpperCase() ?? "FS") as GanttDependencyType;
    const lagDays = match[3] ? Number(match[3]) : 0;
    if (!Number.isFinite(rowNumber) || rowNumber < 1) continue;
    tokens.push({ rowNumber, type, lagDays });
  }
  return tokens;
}

export function parsePredecessorTextError(text: string): string | undefined {
  const raw = text.trim();
  if (!raw || raw === "—") return undefined;
  for (const part of raw.split(/[,;]\s*/)) {
    const chunk = part.trim();
    if (!chunk) continue;
    if (!TOKEN_RE.test(chunk.replace(/\s+/g, ""))) {
      return "Формат: 3FS+2d или 4SS-1d";
    }
  }
  return undefined;
}

export function tokensToDependencies(
  rowId: string,
  tokens: ParsedPredecessorToken[],
  rows: GanttRow[],
  existing: GanttDependency[]
): { dependencies: GanttDependency[]; error?: string } {
  const visibleIndex = new Map(rows.map((r, i) => [i + 1, r.id]));
  const next = existing.filter((d) => d.toId !== rowId);
  const rowIds = new Set(rows.map((r) => r.id));

  for (const token of tokens) {
    const fromId = visibleIndex.get(token.rowNumber);
    if (!fromId) return { dependencies: existing, error: `Нет строки №${token.rowNumber}` };
    if (fromId === rowId) return { dependencies: existing, error: "Задача не может зависеть от себя" };
    if (!rowIds.has(fromId)) return { dependencies: existing, error: "Не найдена строка для связи" };

    const duplicate = next.some(
      (d) =>
        d.fromId === fromId &&
        d.toId === rowId &&
        (d.type ?? "FS") === token.type &&
        (d.lagDays ?? 0) === token.lagDays
    );
    if (duplicate) return { dependencies: existing, error: "Такая связь уже есть" };

    next.push({
      id: `dep-${fromId}-${rowId}-${token.type}-${Date.now()}`,
      fromId,
      toId: rowId,
      type: token.type,
      lagDays: token.lagDays
    });
  }

  return { dependencies: next };
}
