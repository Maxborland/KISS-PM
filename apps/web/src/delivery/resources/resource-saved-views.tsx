"use client";

import { PlanningSavedViews } from "@/delivery/schedule/schedule-saved-views";
import type { Gran } from "@/delivery/resources/resource-load-matrix";

export type ResourceSavedViewState = {
  granularity: Gran;
  monthOffset: number;
  collapsedGroupIds: string[];
  onlyOverload: boolean;
  hideIdle: boolean;
  teamFilter: string;
  roleFilter: string;
  projectFilter: string;
  sortBy: "load" | "name";
};

export type ResourceSavedViewPayload = {
  version: 2;
  surface: "resource-matrix";
  state: ResourceSavedViewState;
};

const DEFAULT_STATE: ResourceSavedViewState = {
  granularity: "day",
  monthOffset: 0,
  collapsedGroupIds: [],
  onlyOverload: false,
  hideIdle: false,
  teamFilter: "all",
  roleFilter: "all",
  projectFilter: "all",
  sortBy: "load"
};

export function parseResourceSavedViewPayload(value: unknown): ResourceSavedViewPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (payload.version !== undefined && payload.version !== 1 && payload.version !== 2) return null;
  if (payload.version === 2 && payload.surface !== "resource-matrix") return null;
  if (payload.version !== 2 && !isResourceSavedViewPayload(payload)) return null;
  const raw = payload.version === 2 ? payload.state : payload;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const state = raw as Record<string, unknown>;
  const granularity = state.granularity ?? state.gran ?? DEFAULT_STATE.granularity;
  const monthOffset = state.monthOffset ?? DEFAULT_STATE.monthOffset;
  const collapsedGroupIds = state.collapsedGroupIds ?? state.collapsed ?? DEFAULT_STATE.collapsedGroupIds;
  const onlyOverload = state.onlyOverload ?? DEFAULT_STATE.onlyOverload;
  const hideIdle = state.hideIdle ?? DEFAULT_STATE.hideIdle;
  const teamFilter = state.teamFilter ?? DEFAULT_STATE.teamFilter;
  const roleFilter = state.roleFilter ?? DEFAULT_STATE.roleFilter;
  const projectFilter = state.projectFilter ?? DEFAULT_STATE.projectFilter;
  const sortBy = state.sortBy ?? DEFAULT_STATE.sortBy;
  if (granularity !== "day" && granularity !== "week" && granularity !== "month") return null;
  if (!Number.isInteger(monthOffset) || (monthOffset as number) < 0 || (monthOffset as number) > 1200) return null;
  if (!Array.isArray(collapsedGroupIds) || !collapsedGroupIds.every((id) => typeof id === "string" && id.length > 0)) return null;
  if (typeof onlyOverload !== "boolean" || typeof hideIdle !== "boolean") return null;
  if (![teamFilter, roleFilter, projectFilter].every((filter) => typeof filter === "string" && filter.length > 0)) return null;
  if (sortBy !== "load" && sortBy !== "name") return null;
  return { version: 2, surface: "resource-matrix", state: {
    granularity, monthOffset: monthOffset as number,
    collapsedGroupIds: [...new Set(collapsedGroupIds as string[])], onlyOverload, hideIdle,
    teamFilter: teamFilter as string, roleFilter: roleFilter as string, projectFilter: projectFilter as string, sortBy
  } };
}
export function sanitizeResourceSavedViewState(state: ResourceSavedViewState, availability: {
  teamIds: ReadonlySet<string>;
  roleIds: ReadonlySet<string>;
  projectIds: ReadonlySet<string>;
  monthCount: number;
}): { state: ResourceSavedViewState; partial: boolean } {
  const teamFilter = state.teamFilter === "all" || availability.teamIds.has(state.teamFilter) ? state.teamFilter : "all";
  const roleFilter = state.roleFilter === "all" || availability.roleIds.has(state.roleFilter) ? state.roleFilter : "all";
  const projectFilter = state.projectFilter === "all" || availability.projectIds.has(state.projectFilter) ? state.projectFilter : "all";
  const monthOffset = Math.min(state.monthOffset, Math.max(0, availability.monthCount - 1));
  return {
    state: { ...state, teamFilter, roleFilter, projectFilter, monthOffset },
    partial: teamFilter !== state.teamFilter || roleFilter !== state.roleFilter
      || projectFilter !== state.projectFilter || monthOffset !== state.monthOffset
  };
}


export function sameResourceSavedView(left: ResourceSavedViewPayload, right: ResourceSavedViewPayload): boolean {
  const a = left.state;
  const b = right.state;
  return a.granularity === b.granularity && a.monthOffset === b.monthOffset
    && a.onlyOverload === b.onlyOverload && a.hideIdle === b.hideIdle
    && a.teamFilter === b.teamFilter && a.roleFilter === b.roleFilter
    && a.projectFilter === b.projectFilter && a.sortBy === b.sortBy
    && a.collapsedGroupIds.length === b.collapsedGroupIds.length
    && a.collapsedGroupIds.every((id) => b.collapsedGroupIds.includes(id));
}

export function ResourceSavedViews({ projectId, canManage, current, onApply }: {
  projectId: string;
  canManage: boolean;
  current: ResourceSavedViewPayload;
  onApply: (payload: ResourceSavedViewPayload) => void;
}) {
  return <PlanningSavedViews projectId={projectId} canManage={canManage} current={current} onApply={onApply}
    parsePayload={parseResourceSavedViewPayload} belongsToSurface={isResourceSavedViewPayload} samePayload={sameResourceSavedView}
    description="Текущий период, группировка, фильтры и сортировка ресурсной матрицы." />;
}

function isResourceSavedViewPayload(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  if (payload.version === 2) return payload.surface === "resource-matrix";
  if (payload.version !== undefined && payload.version !== 1) return false;
  return ["granularity", "gran", "monthOffset", "collapsedGroupIds", "collapsed", "onlyOverload", "hideIdle", "teamFilter", "roleFilter", "projectFilter", "sortBy"]
    .some((key) => key in payload);
}
