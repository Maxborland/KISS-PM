"use client";

import { Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export type ProjectCustomFieldDefinition = {
  id: string; systemKey: string; tenantLabel: string; targetEntity: string;
  fieldType: "text" | "number" | "date" | "select";
  required: boolean; status: "draft" | "active" | "archived";
  createdAt: string; updatedAt: string;
};
type Draft = Pick<ProjectCustomFieldDefinition, "systemKey" | "tenantLabel" | "fieldType" | "required" | "status">;
const EMPTY: Draft = { systemKey: "", tenantLabel: "", fieldType: "text", required: false, status: "draft" };
const TYPES = { text: "Текст", number: "Число", date: "Дата", select: "Список" } as const;
const STATUSES = { draft: "Черновик", active: "Активно", archived: "В архиве" } as const;

export function ProjectCustomFields({ canManage }: { canManage: boolean }) {
  const [fields, setFields] = useState<ProjectCustomFieldDefinition[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutating = useRef(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setStatus("loading");
    try {
      const response = await fetch("/api/workspace/config/custom-fields", { credentials: "include", ...(signal ? { signal } : {}) });
      if (!response.ok) throw new Error("custom_fields_load_failed");
      const body = await response.json() as { customFields?: unknown };
      const next = Array.isArray(body.customFields)
        ? body.customFields.filter(isField).filter((field) => field.targetEntity === "project")
        : [];
      setFields(next.sort((a, b) => a.systemKey.localeCompare(b.systemKey, "ru")));
      setStatus("ready");
    } catch (error) {
      if ((error as { name?: string }).name !== "AbortError") setStatus("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const valid = useMemo(() => /^[a-z][a-z0-9_]{1,63}$/.test(draft.systemKey) && draft.tenantLabel.trim().length > 0, [draft]);
  const cancel = () => { setEditingId(null); setDraft(EMPTY); setPreview(false); };
  const startEdit = (field: ProjectCustomFieldDefinition) => {
    setEditingId(field.id);
    setDraft({ systemKey: field.systemKey, tenantLabel: field.tenantLabel, fieldType: field.fieldType, required: field.required, status: field.status });
    setPreview(false);
  };

  async function apply() {
    if (!canManage || !valid || mutating.current) return;
    mutating.current = true; setBusy(true);
    try {
      const wasEditing = Boolean(editingId);
      const response = await fetch(editingId ? `/api/workspace/config/custom-fields/${encodeURIComponent(editingId)}` : "/api/workspace/config/custom-fields", {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
        body: JSON.stringify({ ...draft, targetEntity: "project" })
      });
      const body = await response.json().catch(() => ({})) as { customField?: unknown; error?: string };
      if (!response.ok) throw new Error(body.error ?? "custom_field_write_failed");
      if (!isField(body.customField)) throw new Error("custom_field_response_invalid");
      await load(); cancel();
      toast.success(wasEditing ? "Поле WBS обновлено" : "Поле WBS создано");
    } catch (error) {
      toast.error(`Не удалось сохранить поле: ${(error as Error).message}`);
    } finally { mutating.current = false; setBusy(false); }
  }

  async function remove(field: ProjectCustomFieldDefinition) {
    if (!canManage || mutating.current) return;
    mutating.current = true; setBusy(true);
    try {
      const response = await fetch(`/api/workspace/config/custom-fields/${encodeURIComponent(field.id)}`, {
        method: "DELETE", credentials: "include", headers: { "x-kiss-pm-action": "same-origin" }
      });
      if (!response.ok) throw new Error("custom_field_delete_failed");
      await load(); toast.success("Поле WBS удалено");
    } catch { toast.error("Не удалось удалить поле WBS"); }
    finally { mutating.current = false; setBusy(false); }
  }

  return <div data-testid="custom-field-definitions" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Поля задач WBS задаются на уровне рабочей области и доступны всем проектам.</p>
      {canManage && editingId === null ? <Button data-testid="custom-field-add" variant="secondary" size="sm" onClick={() => { setEditingId(""); setDraft(EMPTY); setPreview(false); }}><Plus className="size-3.5" aria-hidden />Добавить поле</Button> : null}
    </div>
    {status === "loading" ? <p data-testid="custom-fields-loading" className="text-[length:var(--text-sm)] text-[var(--muted)]">Загрузка полей WBS…</p>
      : status === "error" ? <div data-testid="custom-fields-error" className="flex items-center gap-2 text-[length:var(--text-sm)] text-[var(--danger)]">Не удалось загрузить поля WBS.<Button variant="ghost" size="sm" onClick={() => void load()}><RefreshCw className="size-3.5" aria-hidden />Повторить</Button></div>
      : fields.length === 0 && editingId === null ? <div data-testid="custom-fields-empty" className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-3 py-4 text-center text-[length:var(--text-sm)] text-[var(--muted)]">Пользовательские поля WBS пока не созданы.</div>
      : <div className="divide-y divide-[var(--border)] rounded-[var(--radius-md)] border border-[var(--border)]">{fields.map((field) =>
        <div key={field.id} data-testid={`custom-field-row-${field.id}`} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
          <div><div className="flex flex-wrap items-center gap-2"><strong>{field.tenantLabel}</strong><span className="rounded-[var(--radius-xs)] bg-[var(--panel-strong)] px-1.5 py-0.5 text-[length:var(--text-2xs)]">{STATUSES[field.status]}</span></div><p className="v4-num text-[length:var(--text-xs)] text-[var(--muted)]">{field.systemKey} · {TYPES[field.fieldType]}{field.required ? " · обязательное" : ""}</p></div>
          {canManage ? <div className="flex gap-1"><Button aria-label={`Изменить поле ${field.tenantLabel}`} variant="ghost" size="icon-sm" disabled={busy} onClick={() => startEdit(field)}><Pencil className="size-3.5" /></Button><Button aria-label={`Удалить поле ${field.tenantLabel}`} variant="ghost" size="icon-sm" disabled={busy} onClick={() => void remove(field)}><Trash2 className="size-3.5" /></Button></div> : null}
        </div>)}</div>}
    {canManage && editingId !== null ? <div data-testid="custom-field-editor" className="rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] p-3">
      {preview ? <div data-testid="custom-field-preview" className="space-y-2"><strong>Проверьте изменение</strong><dl className="grid grid-cols-2 gap-1 text-[length:var(--text-sm)]"><dt>Название</dt><dd>{draft.tenantLabel.trim()}</dd><dt>Ключ</dt><dd>{draft.systemKey}</dd><dt>Тип</dt><dd>{TYPES[draft.fieldType]}</dd><dt>Статус</dt><dd>{STATUSES[draft.status]}</dd></dl><div className="flex gap-2"><Button data-testid="custom-field-apply" size="sm" disabled={busy} onClick={() => void apply()}>Применить</Button><Button variant="ghost" size="sm" onClick={() => setPreview(false)}>Назад</Button></div></div>
        : <div className="space-y-3"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>Название<Input data-testid="custom-field-label" value={draft.tenantLabel} onChange={(e) => setDraft((v) => ({ ...v, tenantLabel: e.target.value }))} /></label>
          <label>Системный ключ<Input data-testid="custom-field-key" value={draft.systemKey} disabled={editingId !== ""} onChange={(e) => setDraft((v) => ({ ...v, systemKey: e.target.value }))} /></label>
          <label>Тип<select data-testid="custom-field-type" className="mt-1 h-9 w-full border bg-[var(--panel)] px-2" value={draft.fieldType} onChange={(e) => setDraft((v) => ({ ...v, fieldType: e.target.value as Draft["fieldType"] }))}>{Object.entries(TYPES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
          <label>Статус<select data-testid="custom-field-status" className="mt-1 h-9 w-full border bg-[var(--panel)] px-2" value={draft.status} onChange={(e) => setDraft((v) => ({ ...v, status: e.target.value as Draft["status"] }))}>{Object.entries(STATUSES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
        </div><label className="flex items-center gap-2"><Checkbox data-testid="custom-field-required" checked={draft.required} onCheckedChange={(checked) => setDraft((v) => ({ ...v, required: checked === true }))} />Обязательное поле</label><div className="flex gap-2"><Button data-testid="custom-field-open-preview" size="sm" disabled={!valid || busy} onClick={() => setPreview(true)}>Предпросмотр</Button><Button variant="ghost" size="sm" onClick={cancel}><X className="size-3.5" />Отмена</Button></div></div>}
    </div> : null}
    {!canManage ? <p data-testid="custom-fields-read-only" className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Только чтение. Изменять определения может администратор рабочей области.</p> : null}
  </div>;
}

function isField(value: unknown): value is ProjectCustomFieldDefinition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const f = value as Record<string, unknown>;
  return typeof f.id === "string" && typeof f.systemKey === "string" && typeof f.tenantLabel === "string"
    && typeof f.targetEntity === "string" && ["text", "number", "date", "select"].includes(String(f.fieldType))
    && typeof f.required === "boolean" && ["draft", "active", "archived"].includes(String(f.status))
    && typeof f.createdAt === "string" && typeof f.updatedAt === "string";
}
