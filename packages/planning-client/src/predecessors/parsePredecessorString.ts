import type { DependencyType } from "@kiss-pm/domain";

import { RU_DEPENDENCY_CODES, type ParsedPredecessorLink, type PredecessorParseResult } from "./types";

const EN_CODES = new Set(["FS", "SS", "FF", "SF"]);
const LAG_UNIT_MINUTES: Record<string, number> = {
  д: 24 * 60,
  дн: 24 * 60,
  день: 24 * 60,
  дня: 24 * 60,
  дней: 24 * 60,
  d: 24 * 60,
  day: 24 * 60,
  days: 24 * 60,
  ч: 60,
  h: 60,
  hour: 60,
  hours: 60,
  м: 1,
  m: 1,
  min: 1,
  mins: 1
};

export function parsePredecessorString(input: string): PredecessorParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, links: [] };

  const segments = trimmed.split(";").map((segment) => segment.trim()).filter(Boolean);
  const links: ParsedPredecessorLink[] = [];
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    const parsed = parseSegment(segment);
    if (!parsed.ok) {
      issues.push(parsed.error);
      continue;
    }
    for (const link of parsed.links) {
      const key = `${link.predecessorWbsIndex}:${link.dependencyType}:${link.lagMinutes}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push(link);
    }
  }

  if (issues.length > 0) return { ok: false, error: "predecessor_invalid", issues };
  return { ok: true, links };
}

function parseSegment(segment: string):
  | { ok: true; links: ParsedPredecessorLink[] }
  | { ok: false; error: string } {
  const compact = segment.replace(/\s+/g, "");
  const match = /^([\d,]+)([A-Za-zА-Яа-я]{2})?([+-]\d+(?:[.,]\d+)?[A-Za-zА-Яа-я]+)?$/iu.exec(compact);
  if (!match) return { ok: false, error: `Неверный формат: ${segment}` };

  const indices = match[1]!
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  if (indices.length === 0) {
    return { ok: false, error: `Номер задачи должен быть положительным: ${segment}` };
  }

  const codeRaw = match[2]?.toUpperCase() ?? "ОН";
  const dependencyType = resolveDependencyType(codeRaw);
  if (!dependencyType) return { ok: false, error: `Неизвестный тип связи: ${codeRaw}` };

  const lagRaw = match[3];
  const lagMinutes = lagRaw ? parseLagMinutes(lagRaw) : 0;
  if (lagMinutes === null) return { ok: false, error: `Неверный lag: ${segment}` };

  return {
    ok: true,
    links: indices.map((predecessorWbsIndex) => ({
      predecessorWbsIndex,
      dependencyType,
      lagMinutes
    }))
  };
}

function resolveDependencyType(code: string): DependencyType | null {
  if (EN_CODES.has(code)) return code as DependencyType;
  return RU_DEPENDENCY_CODES[code] ?? null;
}

function parseLagMinutes(raw: string): number | null {
  const normalized = raw.replace(/\s+/g, "");
  const sign = normalized.startsWith("-") ? -1 : 1;
  const magnitude = normalized.replace(/^[+-]/, "");
  const unitMatch = /^(\d+(?:[.,]\d+)?)([A-Za-zА-Яа-я]+)$/u.exec(magnitude);
  if (!unitMatch) return null;
  const value = Number(unitMatch[1]!.replace(",", "."));
  const unitKey = unitMatch[2]!.toLowerCase();
  const minutesPerUnit = LAG_UNIT_MINUTES[unitKey];
  if (!minutesPerUnit || !Number.isFinite(value)) return null;
  return Math.round(sign * value * minutesPerUnit);
}
