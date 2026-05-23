import type { DependencyType } from "@kiss-pm/domain";

export type ParsedPredecessorLink = {
  predecessorWbsIndex: number;
  dependencyType: DependencyType;
  lagMinutes: number;
};

export type PredecessorParseResult =
  | { ok: true; links: ParsedPredecessorLink[] }
  | { ok: false; error: string; issues: string[] };

export const RU_DEPENDENCY_CODES: Record<string, DependencyType> = {
  ОН: "FS",
  НН: "SS",
  ОО: "FF",
  НО: "SF"
};

export const EN_TO_RU_DEPENDENCY: Record<DependencyType, string> = {
  FS: "ОН",
  SS: "НН",
  FF: "ОО",
  SF: "НО"
};
