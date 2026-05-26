import type { DependencyType } from "@kiss-pm/domain";

import { EN_TO_RU_DEPENDENCY } from "./types";

export type PredecessorDisplayLink = {
  predecessorWbsIndex: number;
  dependencyType: DependencyType;
  lagMinutes: number;
};

export function serializePredecessorString(links: PredecessorDisplayLink[]): string {
  if (links.length === 0) return "";
  return links.map(formatLink).join("; ");
}

function formatLink(link: PredecessorDisplayLink): string {
  const code = EN_TO_RU_DEPENDENCY[link.dependencyType];
  const lag = formatLag(link.lagMinutes);
  return `${link.predecessorWbsIndex}${code}${lag}`;
}

function formatLag(lagMinutes: number): string {
  if (lagMinutes === 0) return "";
  const sign = lagMinutes > 0 ? "+" : "-";
  const absolute = Math.abs(lagMinutes);
  if (absolute % (24 * 60) === 0) {
    return `${sign}${absolute / (24 * 60)}д`;
  }
  if (absolute % 60 === 0) {
    return `${sign}${absolute / 60}ч`;
  }
  return `${sign}${absolute}м`;
}
