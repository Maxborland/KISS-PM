"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DialogError, FormDialog } from "@/components/domain/form-dialog";
import { SurfaceState } from "@/components/domain/surface-state";
import { AdminFrame } from "@/admin/ui/admin-frame";
import { adminErr, permissionParts } from "@/admin/ui/admin-bits";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { useAdmin } from "@/admin/lib/use-admin";
import { useAdminRuntime } from "@/admin/lib/admin-runtime";
import { ALL_PERMISSIONS } from "@/admin/lib/permissions-catalog";
import type { AccessProfile, Permission } from "@/admin/lib/admin-client";

const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";

// Группировка прав по РЕСУРСУ с человеческим заголовком (G6-09): «Проекты», «Сделки»…
// Неразобранный код падает в группу по первому dot-сегменту (fallback).
const GROUP_FALLBACK_LABEL: Record<string, string> = { tenant: "Прочие права", profile: "Профиль", workspace: "Настройки" };
type PermissionGroup = { key: string; label: string; permissions: Permission[] };
function buildPermissionGroups(permissions: Permission[]): PermissionGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, Permission[]>();
  for (const p of permissions) {
    const first = p.split(".")[0] ?? p;
    const key = permissionParts(p)?.resourceLabel ?? GROUP_FALLBACK_LABEL[first] ?? first;
    if (!byKey.has(key)) { byKey.set(key, []); order.push(key); }
    byKey.get(key)!.push(p);
  }
  return order.map((key) => ({ key, label: key, permissions: byKey.get(key)! }));
}

// «просмотр» → «Просмотр» (подпись чекбокса).
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Слаг из названия роли → допустимый route-id (a-z0-9 старт, далее _-, длина 3..120).
// Кириллица-only имя (частый кейс RU-UI, напр. «Координатор») целиком вырезается
// → base='' → нужен уникальный суффикс, иначе все такие роли коллапсируют в один id
// и второе создание ловит access_role_id_taken.
const slugify = (name: string): string => {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const id = base.length >= 3 ? base : `${base || "role"}-${Date.now().toString(36)}`;
  return `role-${id}`.replace(/^role-role-/, "role-").slice(0, 120);
};

export function AdminRolesSurface() {
  const { live } = useAdminRuntime();
  const admin = useAdmin();
  const { data, status, error, reload, createRole, updateRole, deleteRole } = admin;
  // Каталог прав из бэка (GET /permission-catalog); ALL_PERMISSIONS — типизированный fallback на время загрузки.
  const groups = useMemo(() => buildPermissionGroups(data?.permissions ?? ALL_PERMISSIONS), [data?.permissions]);
  const [busy, setBusy] = useState(false);

  // число пользователей на каждую роль (для колонки «Назначено»)
  const assigned = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of data?.users ?? []) m.set(u.accessProfileId, (m.get(u.accessProfileId) ?? 0) + 1);
    return m;
  }, [data]);

  const surfaceStatus = status === "loading" ? "loading" : status === "error" ? "error" : !data ? "error" : data.roles.length === 0 ? "empty" : "ready";

  const remove = async (role: AccessProfile) => {
    setBusy(true);
    // назначенная роль не удаляется → access_role_assigned; роль актора → self_access_role_delete_forbidden.
    const res = await deleteRole(role.id);
    setBusy(false);
    if (res.ok) toast.success(`Роль «${role.name}» удалена`);
    else toast.error(`Отклонено: ${adminErr(res.code, res.message)}`);
  };

  return (
    <AdminFrame
      activeTab="Роли"
      subtitle="Роли доступа"
      actions={<CreateRoleDialog busy={busy} setBusy={setBusy} create={createRole} groups={groups} />}
    >
      {/* Плашка-прототип: только вне live (раньше пряталась display:none и оставалась в DOM). */}
      {!live ? (
      <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
        <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
        <span>Реальный контракт админки: GET/PATCH/DELETE /api/workspace/access-roles, POST /api/tenant/current/access-profiles (createAdminClient + in-memory mock, swap = apiOrigin). Права — полный перечень access-control, full-replace при правке. Назначенную роль удалить нельзя (access_role_assigned). Данные in-memory.</span>
      </div>
      ) : null}

      <SurfaceState
        status={surfaceStatus}
        error={error}
        onRetry={() => void reload()}
        errorFormat={(c) => adminErr(c)}
        empty={{ title: "Ролей пока нет", description: "Создайте первую роль доступа с набором прав." }}
      >
        {data ? (
          <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
            <table className="w-full border-collapse text-[length:var(--text-sm)]">
              <thead><tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
                <th className="px-3 py-2 font-semibold">Роль</th><th className="px-3 py-2 text-right font-semibold">Прав</th><th className="px-3 py-2 text-right font-semibold">Назначено</th><th className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {data.roles.map((r) => {
                  const count = assigned.get(r.id) ?? 0;
                  return (
                    <tr key={r.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                      <td className="px-3 py-2"><div className="font-medium text-[var(--text-strong)]">{r.name}</div>{prototypeNotesEnabled ? <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{r.id}</div> : null}</td>
                      <td className="px-3 py-2 text-right v4-num text-[var(--muted-strong)]">{r.permissions.length}</td>
                      <td className="px-3 py-2 text-right v4-num text-[var(--muted-strong)]">{count}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <EditRoleDialog role={r} assignedCount={count} busy={busy} setBusy={setBusy} update={updateRole} groups={groups} />
                          <ConfirmDialog
                            title={`Удалить роль «${r.name}»?`}
                            description={count > 0
                              ? `Роль назначена пользователям (${count}). Удаление будет отклонено — сначала переназначьте их.`
                              : "Действие необратимо. Роль будет удалена из рабочей области."}
                            confirmLabel="Удалить роль"
                            onConfirm={() => remove(r)}
                          >
                            <Button variant="ghost" size="sm" disabled={busy} title={count > 0 ? "Назначена пользователям — удаление отклонится" : "Удалить роль"}><Trash2 className="size-3.5" aria-hidden /></Button>
                          </ConfirmDialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </SurfaceState>
    </AdminFrame>
  );
}

/** Чек-лист прав, сгруппированный по префиксу. Управляет Set выбранных permission-строк. */
function PermissionChecklist({ selected, toggle, groups }: { selected: Set<Permission>; toggle: (p: Permission) => void; groups: PermissionGroup[] }) {
  return (
    <div className="flex max-h-[44vh] flex-col gap-3 overflow-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-2.5">
      {groups.map((group) => (
        <fieldset key={group.key} className="flex flex-col gap-1">
          <legend className="mb-1 text-[length:var(--text-xs)] font-semibold text-[var(--muted-strong)]">{group.label}</legend>
          <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
            {group.permissions.map((p) => {
              const parts = permissionParts(p);
              return (
                <label key={p} className="flex cursor-pointer items-start gap-2 text-[length:var(--text-xs)] text-[var(--text)]">
                  <input type="checkbox" checked={selected.has(p)} onChange={() => toggle(p)} className="mt-0.5 size-3.5 shrink-0 accent-[var(--accent)]" />
                  <span className="flex min-w-0 flex-col">
                    {/* Человеческая подпись действия; неизвестный код — как есть (G6-09). */}
                    <span className={parts ? "truncate" : "v4-mono truncate"}>{parts ? cap(parts.actionLabel) : p}</span>
                    {/* Код права — dev-подсказка, видна только в Storybook/демо. */}
                    {prototypeNotesEnabled && parts ? <span className="v4-mono truncate text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{p}</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function CreateRoleDialog({ busy, setBusy, create, groups }: {
  busy: boolean; setBusy: (v: boolean) => void;
  create: ReturnType<typeof useAdmin>["createRole"]; groups: PermissionGroup[];
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<Permission>>(() => new Set());
  const toggle = (p: Permission) => setSelected((prev) => { const next = new Set(prev); if (next.has(p)) next.delete(p); else next.add(p); return next; });

  const valid = name.trim().length > 0;
  return (
    <FormDialog
      title="Новая роль"
      trigger={<Button variant="default" size="sm"><Plus className="size-3.5" aria-hidden />Создать роль</Button>}
      onOpenChange={(v) => { if (v) { setName(""); setSelected(new Set()); } }}
      submitLabel={<><Plus className="size-3.5" aria-hidden />Создать</>}
      submitDisabled={!valid || busy}
      contentClassName="max-w-[640px]"
      successToast={`Роль «${name.trim()}» создана`}
      // Ошибка остаётся В модалке — раньше уходила строкой позади оверлея (G6-02).
      onSubmit={async () => {
        if (!valid) return null;
        setBusy(true);
        // id обязателен — генерируем слаг из названия (боевой route-id формат).
        const permissions = [...selected];
        const res = await create({ id: slugify(name), name: name.trim(), permissions });
        setBusy(false);
        return res.ok ? null : adminErr(res.code, res.message);
      }}
    >
      <div className="flex flex-col gap-3">
        <label className={labelCls}>Название<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Координатор" /></label>
        <div className={labelCls}>Права ({selected.size})<PermissionChecklist selected={selected} toggle={toggle} groups={groups} /></div>
      </div>
    </FormDialog>
  );
}

function EditRoleDialog({ role, assignedCount, busy, setBusy, update, groups }: {
  role: AccessProfile; assignedCount: number; busy: boolean; setBusy: (v: boolean) => void;
  update: ReturnType<typeof useAdmin>["updateRole"]; groups: PermissionGroup[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(role.name);
  const [selected, setSelected] = useState<Set<Permission>>(() => new Set(role.permissions));
  const [confirmedEmpty, setConfirmedEmpty] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const toggle = (p: Permission) => setSelected((prev) => { const next = new Set(prev); if (next.has(p)) next.delete(p); else next.add(p); setConfirmedEmpty(false); return next; });

  const onOpenChange = (v: boolean) => { if (v) { setName(role.name); setSelected(new Set(role.permissions)); setConfirmedEmpty(false); setFormError(null); } setOpen(v); };
  const valid = name.trim().length > 0;
  // ADM-02: обнуление прав назначенной роли лишает доступа всех её пользователей —
  // требуем явного подтверждения, а не молчаливого сохранения.
  const emptyPermsRisk = selected.size === 0 && assignedCount > 0;
  const needsConfirm = emptyPermsRisk && !confirmedEmpty;
  const submit = async () => {
    if (!valid) return;
    if (needsConfirm) { setConfirmedEmpty(true); return; }
    setBusy(true); setFormError(null);
    // full-replace: name + полный набор permissions. Роль актора → self_access_role_update_forbidden.
    const permissions = [...selected];
    const res = await update(role.id, { name: name.trim(), permissions });
    setBusy(false);
    if (res.ok) { toast.success(`Роль «${name.trim()}» обновлена`); setOpen(false); }
    // Ошибка остаётся В модалке — раньше уходила строкой позади оверлея (G6-02).
    else setFormError(adminErr(res.code, res.message));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button variant="ghost" size="sm" title="Изменить права"><Pencil className="size-3.5" aria-hidden /></Button></DialogTrigger>
      <DialogContent className="max-w-[640px]">
        <DialogHeader><DialogTitle>Изменить роль</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          {prototypeNotesEnabled ? <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{role.id}</div> : null}
          <label className={labelCls}>Название<Input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className={labelCls}>Права ({selected.size})<PermissionChecklist selected={selected} toggle={toggle} groups={groups} /></div>
          {emptyPermsRisk ? (
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--danger-muted)] bg-[var(--danger-soft)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--danger-text)]">
              <span>Роль назначена пользователям ({assignedCount}): без единого права они потеряют доступ. Нажмите «Сохранить» ещё раз для подтверждения.</span>
            </div>
          ) : null}
          <DialogError text={formError} />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
          <Button variant={needsConfirm ? "destructive" : "default"} disabled={!valid || busy} onClick={() => void submit()}><Pencil className="size-3.5" aria-hidden />{needsConfirm ? "Сохранить без прав" : confirmedEmpty ? "Подтвердить" : "Сохранить"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
