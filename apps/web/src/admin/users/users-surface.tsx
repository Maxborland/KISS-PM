"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, UserCheck, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SurfaceState } from "@/components/domain/surface-state";
import { AdminFrame } from "@/admin/ui/admin-frame";
import { UserStatusChip, adminErr } from "@/admin/ui/admin-bits";
import { useAdmin } from "@/admin/lib/use-admin";
import { useAdminRuntime } from "@/admin/lib/admin-runtime";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import type { AccessProfile, Position, WorkspaceUser } from "@/admin/lib/admin-client";

const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60";
const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";

// Ошибка внутри модалки — по месту действия (раньше рендерилась строкой ПОЗАДИ модалки, G6-02).
function DialogError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft,var(--panel-subtle))] px-2.5 py-1.5 text-[length:var(--text-xs)] text-[var(--danger-text,var(--danger))]">
      {text}
    </p>
  );
}

export function AdminUsersSurface() {
  const { live } = useAdminRuntime();
  const admin = useAdmin();
  const { data, status, error, reload, createUser, updateUser, deactivateUser } = admin;
  const [busy, setBusy] = useState(false);

  // карта roleId → имя роли (для колонки «Роль»)
  const roleName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data?.roles ?? []) m.set(r.id, r.name);
    return m;
  }, [data]);

  const surfaceStatus = status === "loading" ? "loading" : status === "error" ? "error" : !data ? "error" : data.users.length === 0 ? "empty" : "ready";

  // Деактивация: PATCH status:"inactive" — только через подтверждение (G6-03).
  const deactivate = async (u: WorkspaceUser) => {
    setBusy(true);
    const res = await deactivateUser(u.id);
    setBusy(false);
    if (res.ok) toast.success(`Пользователь «${u.name}» деактивирован`);
    else toast.error(`Отклонено: ${adminErr(res.code, res.message)}`);
  };

  // Реактивация (G6-04): деактивация была необратимой из UI — PATCH status:"active".
  const reactivate = async (u: WorkspaceUser) => {
    setBusy(true);
    const res = await updateUser(u.id, { status: "active" });
    setBusy(false);
    if (res.ok) toast.success(`Пользователь «${u.name}» снова активен`);
    else toast.error(`Отклонено: ${adminErr(res.code, res.message)}`);
  };

  return (
    <AdminFrame
      activeTab="Пользователи"
      subtitle="Пользователи рабочей области"
      actions={data ? <CreateUserDialog roles={data.roles} positions={data.positions} busy={busy} setBusy={setBusy} create={createUser} /> : undefined}
    >
      {!live ? (
        <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          <span>Реальный контракт админки: GET/POST/PATCH /api/workspace/users (createAdminClient + in-memory mock, swap = apiOrigin). Деактивация = PATCH status:&quot;inactive&quot;. Самого себя (текущий — Администратор) деактивировать или сменить себе роль нельзя (self_access_change_forbidden). Политики безопасности (2FA/SSO/whitelist) — во вкладке «Безопасность».</span>
        </div>
      ) : null}

      <SurfaceState
        status={surfaceStatus}
        error={error}
        onRetry={() => void reload()}
        errorFormat={(c) => adminErr(c)}
        empty={{ title: "Пользователей пока нет", description: "Создайте первого пользователя рабочей области." }}
      >
        {data ? (
          <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
            <table className="w-full border-collapse text-[length:var(--text-sm)]">
              <thead><tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
                <th className="px-3 py-2 font-semibold">Пользователь</th><th className="px-3 py-2 font-semibold">Email</th><th className="px-3 py-2 font-semibold">Роль</th><th className="px-3 py-2 font-semibold">Позиция</th><th className="px-3 py-2 font-semibold">Статус</th><th className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-3 py-2"><div className="font-medium text-[var(--text-strong)]">{u.name}</div>{prototypeNotesEnabled ? <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{u.id}</div> : null}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">{u.email}</td>
                    <td className="px-3 py-2 text-[var(--muted-strong)]">{roleName.get(u.accessProfileId) ?? u.accessProfileId}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">{u.positionName ?? "—"}</td>
                    <td className="px-3 py-2"><UserStatusChip status={u.status} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <EditUserDialog user={u} roles={data.roles} positions={data.positions} busy={busy} setBusy={setBusy} update={updateUser} />
                        {u.status === "active" ? (
                          <ConfirmDialog
                            title={`Деактивировать «${u.name}»?`}
                            description="Пользователь потеряет доступ к рабочей области, его активные сессии будут завершены. Его можно будет активировать снова."
                            confirmLabel="Деактивировать"
                            onConfirm={() => deactivate(u)}
                          >
                            <Button variant="ghost" size="sm" disabled={busy} title="Деактивировать"><UserMinus className="size-3.5" aria-hidden /></Button>
                          </ConfirmDialog>
                        ) : (
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void reactivate(u)} title="Активировать снова"><UserCheck className="size-3.5" aria-hidden /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SurfaceState>
    </AdminFrame>
  );
}

function CreateUserDialog({ roles, positions, busy, setBusy, create }: {
  roles: AccessProfile[]; positions: Position[];
  busy: boolean; setBusy: (v: boolean) => void;
  create: ReturnType<typeof useAdmin>["createUser"];
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [accessProfileId, setAccessProfileId] = useState(roles[0]?.id ?? "");
  const [positionId, setPositionId] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const valid = email.trim().length > 0 && name.trim().length > 0 && accessProfileId.length > 0 && password.length >= 8;
  const submit = async () => {
    if (!valid) return;
    setBusy(true); setFormError(null);
    // password обязателен (≥ 8) — боевой контракт; positionId опционален.
    const res = await create({ email: email.trim(), name: name.trim(), accessProfileId, password, positionId: positionId || null });
    setBusy(false);
    if (res.ok) {
      toast.success(`Пользователь «${name.trim()}» создан`);
      setOpen(false); setEmail(""); setName(""); setPositionId(""); setPassword("");
    } else {
      // Ошибка остаётся В модалке — раньше уходила строкой позади оверлея (G6-02).
      setFormError(adminErr(res.code, res.message));
    }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setFormError(null); }}>
      <DialogTrigger asChild><Button variant="default" size="sm"><Plus className="size-3.5" aria-hidden />Создать пользователя</Button></DialogTrigger>
      <DialogContent className="max-w-[480px]">
        <DialogHeader><DialogTitle>Новый пользователь</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <label className={labelCls}>Email<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@kiss-pm.dev" /></label>
          <label className={labelCls}>Имя<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя Фамилия" /></label>
          <label className={labelCls}>Роль доступа
            <select value={accessProfileId} onChange={(e) => setAccessProfileId(e.target.value)} className={selCls}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className={labelCls}>Позиция
            <select value={positionId} onChange={(e) => setPositionId(e.target.value)} className={selCls}>
              <option value="">— без позиции —</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className={labelCls}>Пароль (≥ 8 символов)<Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="временный пароль" aria-invalid={password.length > 0 && password.length < 8} /></label>
          <DialogError text={formError} />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
          <Button variant="default" disabled={!valid || busy} onClick={() => void submit()}><Plus className="size-3.5" aria-hidden />Создать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, roles, positions, busy, setBusy, update }: {
  user: WorkspaceUser; roles: AccessProfile[]; positions: Position[];
  busy: boolean; setBusy: (v: boolean) => void;
  update: ReturnType<typeof useAdmin>["updateUser"];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [accessProfileId, setAccessProfileId] = useState(user.accessProfileId);
  const [positionId, setPositionId] = useState(user.positionId ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  // при открытии диалога синхронизируем форму с текущей записью
  const onOpenChange = (v: boolean) => {
    if (v) { setName(user.name); setEmail(user.email); setAccessProfileId(user.accessProfileId); setPositionId(user.positionId ?? ""); setFormError(null); }
    setOpen(v);
  };
  const valid = name.trim().length > 0 && email.trim().length > 0 && accessProfileId.length > 0;
  const submit = async () => {
    if (!valid) return;
    setBusy(true); setFormError(null);
    // PATCH частичный; смена роли «себе» (user-anna) → self_access_change_forbidden.
    // Смена email (G6-14) проверяется сервером против домен-allowlist политики безопасности.
    const res = await update(user.id, { name: name.trim(), email: email.trim(), accessProfileId, positionId: positionId || null });
    setBusy(false);
    if (res.ok) { toast.success(`Пользователь «${name.trim()}» обновлён`); setOpen(false); }
    else setFormError(adminErr(res.code, res.message));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button variant="ghost" size="sm" title="Изменить"><Pencil className="size-3.5" aria-hidden /></Button></DialogTrigger>
      <DialogContent className="max-w-[480px]">
        <DialogHeader><DialogTitle>Изменить пользователя</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          {prototypeNotesEnabled ? (
            <div className="flex flex-col gap-0.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] px-2.5 py-1.5">
              <span className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{user.id}</span>
            </div>
          ) : null}
          <label className={labelCls}>Email
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">Смена email завершит активные сессии пользователя.</span>
          </label>
          <label className={labelCls}>Имя<Input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className={labelCls}>Роль доступа
            <select value={accessProfileId} onChange={(e) => setAccessProfileId(e.target.value)} className={selCls}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className={labelCls}>Позиция
            <select value={positionId} onChange={(e) => setPositionId(e.target.value)} className={selCls}>
              <option value="">— без позиции —</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <DialogError text={formError} />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
          <Button variant="default" disabled={!valid || busy} onClick={() => void submit()}><Pencil className="size-3.5" aria-hidden />Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
