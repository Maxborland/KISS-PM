"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SurfaceState } from "@/components/domain/surface-state";
import { AdminFrame } from "@/admin/ui/admin-frame";
import { adminErr } from "@/admin/ui/admin-bits";
import { useAdmin } from "@/admin/lib/use-admin";
import { ALL_PERMISSIONS } from "@/admin/lib/mock-admin-backend";
import type { AccessProfile, Permission } from "@/admin/lib/admin-client";

const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";

// Группировка прав по префиксу (первый dot-сегмент): tenant.* / profile.* / workspace.*.
const GROUP_LABEL: Record<string, string> = { tenant: "Рабочая область (tenant.*)", profile: "Профиль (profile.*)", workspace: "Настройки (workspace.*)" };
const PERMISSION_GROUPS: { key: string; label: string; permissions: Permission[] }[] = (() => {
  const order: string[] = [];
  const byKey = new Map<string, Permission[]>();
  for (const p of ALL_PERMISSIONS) {
    const key = p.split(".")[0] ?? p;
    if (!byKey.has(key)) { byKey.set(key, []); order.push(key); }
    byKey.get(key)!.push(p);
  }
  return order.map((key) => ({ key, label: GROUP_LABEL[key] ?? key, permissions: byKey.get(key)! }));
})();

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
  const admin = useAdmin();
  const { data, status, error, reload, createRole, updateRole, deleteRole } = admin;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // число пользователей на каждую роль (для колонки «Назначено»)
  const assigned = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of data?.users ?? []) m.set(u.accessProfileId, (m.get(u.accessProfileId) ?? 0) + 1);
    return m;
  }, [data]);

  const surfaceStatus = status === "loading" ? "loading" : status === "error" ? "error" : !data ? "error" : data.roles.length === 0 ? "empty" : "ready";

  const remove = async (role: AccessProfile) => {
    setBusy(true); setNotice(null);
    // назначенная роль не удаляется → access_role_assigned; роль актора → self_access_role_delete_forbidden.
    const res = await deleteRole(role.id);
    setBusy(false);
    if (res.ok) setNotice(`Роль «${role.name}» удалена`);
    else setNotice(`Отклонено: ${adminErr(res.code, res.message)}`);
  };

  return (
    <AdminFrame
      activeTab="Роли"
      subtitle="Роли доступа (access-profiles)"
      actions={<CreateRoleDialog busy={busy} setBusy={setBusy} setNotice={setNotice} create={createRole} />}
    >
      <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
        <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
        <span>Реальный контракт админки: GET/PATCH/DELETE /api/workspace/access-roles, POST /api/tenant/current/access-profiles (createAdminClient + in-memory mock, swap = apiOrigin). Права — полный перечень access-control, full-replace при правке. Назначенную роль удалить нельзя (access_role_assigned). Данные in-memory.</span>
      </div>

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
                      <td className="px-3 py-2"><div className="font-medium text-[var(--text-strong)]">{r.name}</div><div className="v4-mono text-[10px] text-[var(--muted-soft)]">{r.id}</div></td>
                      <td className="px-3 py-2 text-right v4-num text-[var(--muted-strong)]">{r.permissions.length}</td>
                      <td className="px-3 py-2 text-right v4-num text-[var(--muted-strong)]">{count}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <EditRoleDialog role={r} busy={busy} setBusy={setBusy} setNotice={setNotice} update={updateRole} />
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove(r)} title={count > 0 ? "Назначена пользователям — удаление отклонится" : "Удалить роль"}><Trash2 className="size-3.5" aria-hidden /></Button>
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
      {notice ? <div key={notice} className="anim-rise-in-fast mt-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">{notice}</div> : null}
    </AdminFrame>
  );
}

/** Чек-лист прав, сгруппированный по префиксу. Управляет Set выбранных permission-строк. */
function PermissionChecklist({ selected, toggle }: { selected: Set<Permission>; toggle: (p: Permission) => void }) {
  return (
    <div className="flex max-h-[44vh] flex-col gap-3 overflow-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-2.5">
      {PERMISSION_GROUPS.map((group) => (
        <fieldset key={group.key} className="flex flex-col gap-1">
          <legend className="mb-1 text-[length:var(--text-xs)] font-semibold text-[var(--muted-strong)]">{group.label}</legend>
          <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
            {group.permissions.map((p) => (
              <label key={p} className="flex cursor-pointer items-center gap-2 text-[length:var(--text-xs)] text-[var(--text)]">
                <input type="checkbox" checked={selected.has(p)} onChange={() => toggle(p)} className="size-3.5 accent-[var(--accent)]" />
                <span className="v4-mono truncate">{p}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function CreateRoleDialog({ busy, setBusy, setNotice, create }: {
  busy: boolean; setBusy: (v: boolean) => void; setNotice: (v: string | null) => void;
  create: ReturnType<typeof useAdmin>["createRole"];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<Permission>>(() => new Set());
  const toggle = (p: Permission) => setSelected((prev) => { const next = new Set(prev); if (next.has(p)) next.delete(p); else next.add(p); return next; });

  const onOpenChange = (v: boolean) => { if (v) { setName(""); setSelected(new Set()); } setOpen(v); };
  const valid = name.trim().length > 0;
  const submit = async () => {
    if (!valid) return;
    setBusy(true); setNotice(null);
    // id обязателен — генерируем слаг из названия (боевой route-id формат).
    const permissions = ALL_PERMISSIONS.filter((p) => selected.has(p));
    const res = await create({ id: slugify(name), name: name.trim(), permissions });
    setBusy(false);
    if (res.ok) { setNotice(`Роль «${name.trim()}» создана`); setOpen(false); }
    else setNotice(`Отклонено: ${adminErr(res.code, res.message)}`);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button variant="default" size="sm"><Plus className="size-3.5" aria-hidden />Создать роль</Button></DialogTrigger>
      <DialogContent className="max-w-[640px]">
        <DialogHeader><DialogTitle>Новая роль</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <label className={labelCls}>Название<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Координатор" /></label>
          <div className={labelCls}>Права ({selected.size})<PermissionChecklist selected={selected} toggle={toggle} /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
          <Button variant="default" disabled={!valid || busy} onClick={() => void submit()}><Plus className="size-3.5" aria-hidden />Создать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRoleDialog({ role, busy, setBusy, setNotice, update }: {
  role: AccessProfile; busy: boolean; setBusy: (v: boolean) => void; setNotice: (v: string | null) => void;
  update: ReturnType<typeof useAdmin>["updateRole"];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(role.name);
  const [selected, setSelected] = useState<Set<Permission>>(() => new Set(role.permissions));
  const toggle = (p: Permission) => setSelected((prev) => { const next = new Set(prev); if (next.has(p)) next.delete(p); else next.add(p); return next; });

  const onOpenChange = (v: boolean) => { if (v) { setName(role.name); setSelected(new Set(role.permissions)); } setOpen(v); };
  const valid = name.trim().length > 0;
  const submit = async () => {
    if (!valid) return;
    setBusy(true); setNotice(null);
    // full-replace: name + полный набор permissions. Роль актора → self_access_role_update_forbidden.
    const permissions = ALL_PERMISSIONS.filter((p) => selected.has(p));
    const res = await update(role.id, { name: name.trim(), permissions });
    setBusy(false);
    if (res.ok) { setNotice(`Роль «${name.trim()}» обновлена`); setOpen(false); }
    else setNotice(`Отклонено: ${adminErr(res.code, res.message)}`);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button variant="ghost" size="sm" title="Изменить права"><Pencil className="size-3.5" aria-hidden /></Button></DialogTrigger>
      <DialogContent className="max-w-[640px]">
        <DialogHeader><DialogTitle>Изменить роль</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="v4-mono text-[10px] text-[var(--muted-soft)]">{role.id}</div>
          <label className={labelCls}>Название<Input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className={labelCls}>Права ({selected.size})<PermissionChecklist selected={selected} toggle={toggle} /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
          <Button variant="default" disabled={!valid || busy} onClick={() => void submit()}><Pencil className="size-3.5" aria-hidden />Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
