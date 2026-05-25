/** Текст предшественников Gantt (общий для widget и domain). */

export type GanttDependencyType = "FS" | "SS" | "FF" | "SF";

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
