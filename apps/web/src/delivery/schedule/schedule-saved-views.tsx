"use client";

import { Pencil, RefreshCw, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClientId } from "@/delivery/lib/client-id";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

export type ScheduleZoom = "day" | "week" | "month";

export type ScheduleSavedViewState = {
  zoom: ScheduleZoom;
  columnWidths: number[];
  collapsedTaskIds: string[];
};

export type ScheduleSavedViewPayload = {
  version: 2;
  surface: "schedule";
  state: ScheduleSavedViewState;
};

type SavedView = {
  id: string;
  name: string;
  scope: "user" | "project";
  payload: Record<string, unknown>;
};

type LoadStatus = "loading" | "ready" | "error";

export function parseScheduleSavedViewPayload(value: unknown): ScheduleSavedViewPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (payload.version !== undefined && payload.version !== 1 && payload.version !== 2) return null;
  if (payload.version === 2 && payload.surface !== "schedule") return null;
  const rawState = payload.version === 2 ? payload.state : payload;
  if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) return null;
  const state = rawState as Record<string, unknown>;
  const zoom = state.zoom;
  const columnWidths = state.columnWidths;
  const collapsedTaskIds = state.collapsedTaskIds;
  if (zoom !== "day" && zoom !== "week" && zoom !== "month") return null;
  if (!Array.isArray(columnWidths) || columnWidths.length !== 11) return null;
  if (!columnWidths.every((width) => typeof width === "number" && Number.isFinite(width) && width >= 36 && width <= 600)) return null;
  if (!Array.isArray(collapsedTaskIds) || !collapsedTaskIds.every((id) => typeof id === "string" && id.length > 0)) return null;
  return {
    version: 2,
    surface: "schedule",
    state: {
      zoom,
      columnWidths: [...columnWidths],
      collapsedTaskIds: [...new Set(collapsedTaskIds)]
    }
  };
}

export function PlanningSavedViews<TPayload extends object>({ projectId, canManage, current, onApply, parsePayload, belongsToSurface, samePayload, description }: {
  projectId: string;
  canManage: boolean;
  current: TPayload;
  onApply: (payload: TPayload) => void;
  parsePayload: (value: unknown) => TPayload | null;
  belongsToSurface: (value: unknown) => boolean;
  samePayload: (left: TPayload, right: TPayload) => boolean;
  description: string;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [selectedId, setSelectedId] = useState("");
  const [invalidCount, setInvalidCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [scope, setScope] = useState<"user" | "project">("user");
  const [clientRequestId, setClientRequestId] = useState("");
  const [renameClientRequestId, setRenameClientRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const deleteRequestRef = useRef<{ viewId: string; clientRequestId: string } | null>(null);

  const endpoint = `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/saved-views`;

  const load = useCallback(async (signal?: AbortSignal) => {
    setStatus("loading");
    try {
      const init: RequestInit = { credentials: "include" };
      if (signal) init.signal = signal;
      const response = await fetch(endpoint, init);
      if (!response.ok) throw new Error("saved_views_load_failed");
      const body = await response.json() as { savedViews?: unknown };
      const all = Array.isArray(body.savedViews) ? body.savedViews.filter(isSavedView) : [];
      const relevant = all.filter((view) => belongsToSurface(view.payload));
      const next = relevant
        .filter((view) => parsePayload(view.payload) !== null)
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));
      setInvalidCount(relevant.length - next.length);
      setViews(next);
      setSelectedId((value) => next.some((view) => view.id === value) ? value : "");
      setStatus("ready");
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") return;
      setStatus("error");
    }
  }, [belongsToSurface, endpoint, parsePayload]);

  useEffect(() => {
    const controller = new AbortController();
    setSelectedId("");
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    const selected = views.find((view) => view.id === selectedId);
    const payload = parsePayload(selected?.payload);
    if (!payload || !samePayload(payload, current)) setSelectedId("");
  }, [current, parsePayload, samePayload, selectedId, views]);

  function beginMutation(): boolean {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    return true;
  }

  function endMutation() {
    busyRef.current = false;
    setBusy(false);
  }

  function selectView(viewId: string) {
    setSelectedId(viewId);
    if (!viewId) return;
    const view = views.find((candidate) => candidate.id === viewId);
    const payload = parsePayload(view?.payload);
    if (!payload) {
      toast.error("Сохранённый вид повреждён и не был применён");
      return;
    }
    onApply(payload);
    toast.success(`Вид «${view!.name}» применён`);
  }

  async function createView() {
    const trimmed = name.trim();
    if (!trimmed || !clientRequestId || !beginMutation()) return;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
        body: JSON.stringify({ name: trimmed, scope, payload: current, clientRequestId })
      });
      if (!response.ok) throw new Error("saved_view_create_failed");
      const body = await response.json() as { savedView?: unknown };
      const savedView = body.savedView;
      if (!isSavedView(savedView)) throw new Error("saved_view_response_invalid");
      setViews((previous) => [...previous, savedView].sort((a, b) => a.name.localeCompare(b.name, "ru")));
      setSelectedId(savedView.id);
      setName("");
      setClientRequestId("");
      setDialogOpen(false);
      toast.success("Вид сохранён");
    } catch {
      toast.error("Не удалось сохранить вид");
    } finally {
      endMutation();
    }
  }

  async function renameView() {
    const view = views.find((candidate) => candidate.id === selectedId);
    const trimmed = renameName.trim();
    if (!view || !trimmed || !renameClientRequestId || !beginMutation()) return;
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(view.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
        body: JSON.stringify({ name: trimmed, clientRequestId: renameClientRequestId })
      });
      if (!response.ok) throw new Error("saved_view_rename_failed");
      const body = await response.json() as { savedView?: unknown };
      const savedView = body.savedView;
      if (!isSavedView(savedView)) throw new Error("saved_view_response_invalid");
      setViews((previous) => previous
        .map((candidate) => candidate.id === savedView.id ? savedView : candidate)
        .sort((a, b) => a.name.localeCompare(b.name, "ru")));
      setRenameOpen(false);
      setRenameName("");
      setRenameClientRequestId("");
      toast.success("Вид переименован");
    } catch {
      toast.error("Не удалось переименовать вид");
    } finally {
      endMutation();
    }
  }

  async function deleteView() {
    const view = views.find((candidate) => candidate.id === selectedId);
    if (!view || !beginMutation()) return;
    const pending = deleteRequestRef.current;
    const request = pending?.viewId === view.id
      ? pending
      : { viewId: view.id, clientRequestId: createClientId("saved-view-delete") };
    deleteRequestRef.current = request;
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(view.id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
        body: JSON.stringify({ clientRequestId: request.clientRequestId })
      });
      if (!response.ok) throw new Error("saved_view_delete_failed");
      deleteRequestRef.current = null;
      setViews((previous) => previous.filter((candidate) => candidate.id !== view.id));
      setSelectedId("");
      toast.success("Вид удалён");
    } catch {
      toast.error("Не удалось удалить вид");
    } finally {
      endMutation();
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <select
          data-testid="saved-views-dropdown"
          aria-label="Сохранённый вид"
          value={selectedId}
          disabled={status === "loading"}
          onChange={(event) => selectView(event.target.value)}
          className="h-7 max-w-44 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-xs)] text-[var(--text)]"
        >
          <option value="">
            {status === "loading" ? "Загрузка видов…" : status === "error" ? "Виды недоступны" : views.length ? "Сохранённые виды" : "Нет сохранённых видов"}
          </option>
          {views.map((view) => <option key={view.id} value={view.id}>{view.name}{view.scope === "project" ? " · общий" : ""}</option>)}
          {invalidCount > 0 ? <option disabled>{invalidCount === 1 ? "1 вид недоступен: повреждён" : `${invalidCount} вида недоступны: повреждены`}</option> : null}
        </select>
        {status === "error" ? (
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => void load()} title="Повторить загрузку видов" aria-label="Повторить загрузку видов">
            <RefreshCw aria-hidden />
          </Button>
        ) : null}
        {canManage ? (
          <>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => { setClientRequestId(createClientId("saved-view")); setDialogOpen(true); }} disabled={busy || status !== "ready"} title="Сохранить текущий вид" aria-label="Сохранить текущий вид">
              <Save aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => { const view = views.find((candidate) => candidate.id === selectedId); if (!view) return; setRenameName(view.name); setRenameClientRequestId(createClientId("saved-view-rename")); setRenameOpen(true); }} disabled={busy || !selectedId} title="Переименовать выбранный вид" aria-label="Переименовать выбранный вид">
              <Pencil aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => void deleteView()} disabled={busy || !selectedId} title="Удалить выбранный вид" aria-label="Удалить выбранный вид">
              <Trash2 aria-hidden />
            </Button>
          </>
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!busy) setDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сохранить вид</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <label className="grid gap-1 text-[length:var(--text-sm)] text-[var(--muted-strong)]">
            Название
            <input autoFocus aria-label="Название вида" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createView(); }} className="h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-3 text-[var(--text)] outline-none focus-visible:shadow-[var(--ring-focus)]" />
          </label>
          <label className="grid gap-1 text-[length:var(--text-sm)] text-[var(--muted-strong)]">
            Доступ
            <select aria-label="Доступ к виду" value={scope} onChange={(event) => setScope(event.target.value === "project" ? "project" : "user")} className="h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-3 text-[var(--text)]">
              <option value="user">Только мне</option>
              <option value="project">Всем участникам проекта</option>
            </select>
          </label>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost" disabled={busy}>Отмена</Button></DialogClose>
            <Button type="button" variant="default" disabled={busy || !name.trim()} onClick={() => void createView()}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={(open) => { if (!busy) setRenameOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать вид</DialogTitle>
            <DialogDescription>Новое название будет видно всем, кому доступен этот вид.</DialogDescription>
          </DialogHeader>
          <label className="grid gap-1 text-[length:var(--text-sm)] text-[var(--muted-strong)]">
            Новое название
            <input autoFocus aria-label="Новое название вида" value={renameName} maxLength={80} onChange={(event) => setRenameName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameView(); }} className="h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-3 text-[var(--text)] outline-none focus-visible:shadow-[var(--ring-focus)]" />
          </label>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost" disabled={busy}>Отмена</Button></DialogClose>
            <Button type="button" variant="default" disabled={busy || !renameName.trim()} onClick={() => void renameView()}>Переименовать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ScheduleSavedViews({ projectId, canManage, current, onApply }: {
  projectId: string;
  canManage: boolean;
  current: ScheduleSavedViewPayload;
  onApply: (payload: ScheduleSavedViewPayload) => void;
}) {
  return <PlanningSavedViews projectId={projectId} canManage={canManage} current={current} onApply={onApply}
    parsePayload={parseScheduleSavedViewPayload} belongsToSurface={isScheduleSavedViewPayload} samePayload={sameScheduleView}
    description="Текущий масштаб, ширина колонок и свёрнутые группы." />;
}

function isSavedView(value: unknown): value is SavedView {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const view = value as Record<string, unknown>;
  return typeof view.id === "string"
    && typeof view.name === "string"
    && (view.scope === "user" || view.scope === "project")
    && Boolean(view.payload)
    && typeof view.payload === "object"
    && !Array.isArray(view.payload);
}

function sameScheduleView(left: ScheduleSavedViewPayload, right: ScheduleSavedViewPayload): boolean {
  return left.state.zoom === right.state.zoom
    && left.state.columnWidths.length === right.state.columnWidths.length
    && left.state.columnWidths.every((width, index) => width === right.state.columnWidths[index])
    && left.state.collapsedTaskIds.length === right.state.collapsedTaskIds.length
    && left.state.collapsedTaskIds.every((id) => right.state.collapsedTaskIds.includes(id));
}

function isScheduleSavedViewPayload(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  if (payload.version === 2) return payload.surface === "schedule";
  if (payload.version !== undefined && payload.version !== 1) return false;
  return "zoom" in payload || "columnWidths" in payload || "collapsedTaskIds" in payload;
}
