import { validateDependencyCreation } from "./gantt-dependency-rules";
import type {
  GanttData,
  GanttDependency,
  GanttDependencyEndpoint,
  GanttLinkSession
} from "./types";

export function createLinkSession(
  fromId: string,
  fromEndpoint: GanttDependencyEndpoint,
  pointerX: number,
  pointerY: number
): GanttLinkSession {
  return { fromId, fromEndpoint, pointerX, pointerY };
}

export function patchLinkPointer(
  link: GanttLinkSession,
  pointerX: number,
  pointerY: number,
  hover?: { rowId: string; endpoint: GanttDependencyEndpoint }
): GanttLinkSession {
  return {
    fromId: link.fromId,
    fromEndpoint: link.fromEndpoint,
    pointerX,
    pointerY,
    ...(hover ? { hoverToId: hover.rowId, hoverToEndpoint: hover.endpoint } : {})
  };
}

export type CompleteLinkResult =
  | { ok: true; dependency: GanttDependency }
  | { ok: false; message: string };

export function tryCompleteLink(input: {
  link: GanttLinkSession;
  data: GanttData;
  visibleRowIds: Set<string>;
  toId: string;
  toEndpoint: GanttDependencyEndpoint;
  now?: number;
}): CompleteLinkResult {
  const { link, data, visibleRowIds, toId, toEndpoint, now = Date.now() } = input;
  const result = validateDependencyCreation({
    fromId: link.fromId,
    fromEndpoint: link.fromEndpoint,
    toId,
    toEndpoint,
    dependencies: data.dependencies ?? [],
    rows: data.rows,
    visibleRowIds
  });
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return {
    ok: true,
    dependency: {
      id: `dep-${now}`,
      fromId: link.fromId,
      toId,
      type: result.type
    }
  };
}
