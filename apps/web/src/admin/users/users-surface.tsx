"use client";

import { useMemo, useState } from "react";
import { Copy, KeyRound, Pencil, Plus, UserCheck, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/domain/form-dialog";
import { SurfaceState } from "@/components/domain/surface-state";
import { AdminFrame } from "@/admin/ui/admin-frame";
import { UserStatusChip, adminErr } from "@/admin/ui/admin-bits";
import { useAdmin } from "@/admin/lib/use-admin";
import { useAdminRuntime } from "@/admin/lib/admin-runtime";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { useSessionUser } from "@/shell/use-session-user";
import { getUserActionPolicy } from "./user-action-policy";
import type { AccessProfile, Position, WorkspaceUser } from "@/admin/lib/admin-client";

const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60 [@media(pointer:coarse)]:min-h-[var(--touch-target)]";
const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";

export function AdminUsersSurface() {
  const { live } = useAdminRuntime();
  const admin = useAdmin("users");
  const { data, status, error, reload, createUser, updateUser, deactivateUser, issueUserResetToken } = admin;
  const [busy, setBusy] = useState(false);
  const sessionUser = useSessionUser();

  // карта roleId → имя роли (для колонки «Роль»)
  const roleName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data?.roles ?? []) m.set(r.id, r.name);
    return m;
  }, [data]);

  const surfaceStatus = status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : status === "error" ? "error" : !data ? "error" : data.users.length === 0 ? "empty" : "ready";
  const canManageUsers = sessionUser?.permissions.includes("tenant.users.manage") ?? false;
  const createDisabledReason = !canManageUsers
    ? "Недостаточно прав для управления пользователями."
    : data && data.roles.length === 0
      ? "Создание пользователя недоступно: у роли нет доступа к справочнику ролей."
      : undefined;

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
      actions={data ? <CreateUserDialog roles={data.roles} positions={data.positions} busy={busy} setBusy={setBusy} create={createUser} disabledReason={createDisabledReason} /> : undefined}
    >
      {!live ? (
        <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          <span>Реальный контракт админки: GET/POST/PATCH /api/workspace/users (createAdminClient + in-memory mock, swap = apiOrigin). Деактивация = PATCH status:&quot;inactive&quot;. Выдача токена сброса пароля = POST /api/workspace/users/:userId/password-reset-token (токен показывается один раз). Самого себя (текущий — Администратор) деактивировать или сменить себе роль нельзя (self_access_change_forbidden). Политики безопасности (2FA/SSO/whitelist) — во вкладке «Безопасность».</span>
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
                {data.users.map((u) => {
                  const actionPolicy = getUserActionPolicy({ permissions: sessionUser?.permissions ?? [], currentUserId: sessionUser?.id ?? null, targetUserId: u.id });
                  return (
                  <tr key={u.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-3 py-2"><div className="font-medium text-[var(--text-strong)]">{u.name}</div>{prototypeNotesEnabled ? <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{u.id}</div> : null}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">{u.email}</td>
                    <td className="px-3 py-2 text-[var(--muted-strong)]">{u.accessProfileName ?? roleName.get(u.accessProfileId) ?? "Профиль доступа"}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">{u.positionName ?? "—"}</td>
                    <td className="px-3 py-2"><UserStatusChip status={u.status} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <EditUserDialog user={u} roles={data.roles} positions={data.positions} busy={busy} setBusy={setBusy} update={updateUser} {...(actionPolicy.editDisabledReason ? { disabledReason: actionPolicy.editDisabledReason } : {})} />
                        <IssueResetTokenAction user={u} busy={busy} setBusy={setBusy} issue={issueUserResetToken} {...(actionPolicy.resetTokenDisabledReason ? { disabledReason: actionPolicy.resetTokenDisabledReason } : {})} />
                        {u.status === "active" ? (
                          <ConfirmDialog
                            title={`Деактивировать «${u.name}»?`}
                            description="Пользователь потеряет доступ к рабочей области, его активные сессии будут завершены. Его можно будет активировать снова."
                            confirmLabel="Деактивировать"
                            onConfirm={() => deactivate(u)}
                          >
                            <Button variant="ghost" size="sm" disabled={busy || Boolean(actionPolicy.statusDisabledReason)} title={actionPolicy.statusDisabledReason ?? "Деактивировать"}><UserMinus className="size-3.5" aria-hidden /></Button>
                          </ConfirmDialog>
                        ) : (
                          <Button variant="ghost" size="sm" disabled={busy || Boolean(actionPolicy.statusDisabledReason)} onClick={() => void reactivate(u)} title={actionPolicy.statusDisabledReason ?? "Активировать снова"}><UserCheck className="size-3.5" aria-hidden /></Button>
                        )}
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

// Выдача токена сброса пароля (delivery:none): подтверждение → POST
// /api/workspace/users/:userId/password-reset-token → диалог с токеном.
// ЧЕСТНОСТЬ: токен приходит в ответе ровно один раз — сервер хранит только хэш,
// повторно показать его нельзя (в журнале аудита остаётся только факт выдачи).
export function IssueResetTokenAction({ user, busy, setBusy, issue, disabledReason }: {
  user: WorkspaceUser;
  busy: boolean; setBusy: (v: boolean) => void;
  issue: ReturnType<typeof useAdmin>["issueUserResetToken"];
  disabledReason?: string | undefined;
}) {
  const [issued, setIssued] = useState<{ resetToken: string; expiresAt: string } | null>(null);

  const run = async () => {
    setBusy(true);
    const res = await issue(user.id);
    setBusy(false);
    if (res.ok) setIssued(res.data);
    else toast.error(`Отклонено: ${adminErr(res.code, res.message)}`);
  };

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.resetToken);
      toast.success("Токен скопирован в буфер обмена");
    } catch {
      toast.error("Не удалось скопировать — выделите токен и скопируйте вручную");
    }
  };

  return (
    <>
      <ConfirmDialog
        title={`Выдать токен сброса пароля для «${user.name}»?`}
        description="Токен действует 60 минут и показывается только один раз. Передайте его пользователю по безопасному каналу — ввод на странице /password-reset/confirm."
        confirmLabel="Выдать токен"
        destructive={false}
        onConfirm={run}
      >
        <Button variant="ghost" size="sm" disabled={busy || Boolean(disabledReason)} title={disabledReason ?? "Выдать токен сброса пароля"}><KeyRound className="size-3.5" aria-hidden /></Button>
      </ConfirmDialog>
      <Dialog open={issued !== null} onOpenChange={(open) => { if (!open) setIssued(null); }}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Токен сброса пароля — {user.name}</DialogTitle>
            <DialogDescription>
              Токен показывается один раз: после закрытия окна получить его снова нельзя (в журнале аудита остаётся только факт выдачи).
              Передайте его пользователю по безопасному каналу — ввод на странице /password-reset/confirm.
              {issued ? ` Действует до ${new Date(issued.expiresAt).toLocaleString("ru-RU")}.` : null}
            </DialogDescription>
          </DialogHeader>
          <div data-testid="reset-token-value" className="v4-mono break-all rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--text-strong)]">
            {issued?.resetToken}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => void copy()}><Copy className="size-3.5" aria-hidden />Скопировать</Button>
            <DialogClose asChild><Button variant="default">Готово</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateUserDialog({ roles, positions, busy, setBusy, create, disabledReason }: {
  roles: AccessProfile[]; positions: Position[];
  busy: boolean; setBusy: (v: boolean) => void;
  create: ReturnType<typeof useAdmin>["createUser"];
  disabledReason?: string | undefined;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [accessProfileId, setAccessProfileId] = useState(roles[0]?.id ?? "");
  const [positionId, setPositionId] = useState("");
  const [password, setPassword] = useState("");

  const valid = email.trim().length > 0 && name.trim().length > 0 && accessProfileId.length > 0 && password.length >= 8;
  return (
    <FormDialog
      title="Новый пользователь"
      trigger={<Button variant="default" size="sm" disabled={busy || Boolean(disabledReason)} title={disabledReason ?? "Создать пользователя"}><Plus className="size-3.5" aria-hidden />Создать пользователя</Button>}
      submitLabel={<><Plus className="size-3.5" aria-hidden />Создать</>}
      submitDisabled={!valid || busy || Boolean(disabledReason)}
      contentClassName="max-w-[480px]"
      successToast={`Пользователь «${name.trim()}» создан`}
      // Ошибка остаётся В модалке — раньше уходила строкой позади оверлея (G6-02).
      onSubmit={async () => {
        if (disabledReason) return disabledReason;
        if (!valid) return null;
        setBusy(true);
        // password обязателен (≥ 8) — боевой контракт; positionId опционален.
        const res = await create({ email: email.trim(), name: name.trim(), accessProfileId, password, positionId: positionId || null });
        setBusy(false);
        return res.ok ? null : adminErr(res.code, res.message);
      }}
      onSuccess={() => { setEmail(""); setName(""); setPositionId(""); setPassword(""); }}
    >
      <div className="flex flex-col gap-3">
        <label className={labelCls}>Email<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@kiss-pm.dev" /></label>
        <label className={labelCls}>Имя<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя Фамилия" /></label>
        <label className={labelCls}>Роль доступа
          <select value={accessProfileId} onChange={(e) => setAccessProfileId(e.target.value)} className={selCls} disabled={roles.length === 0}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className={labelCls}>Позиция
          <select value={positionId} onChange={(e) => setPositionId(e.target.value)} className={selCls} disabled={positions.length === 0}>
            <option value="">— без позиции —</option>
            {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className={labelCls}>Пароль (≥ 8 символов)<Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="временный пароль" aria-invalid={password.length > 0 && password.length < 8} /></label>
      </div>
    </FormDialog>
  );
}

export function EditUserDialog({ user, roles, positions, busy, setBusy, update, disabledReason }: {
  user: WorkspaceUser; roles: AccessProfile[]; positions: Position[];
  busy: boolean; setBusy: (v: boolean) => void;
  update: ReturnType<typeof useAdmin>["updateUser"];
  disabledReason?: string;
}) {
  // name/email/accessProfileId могут отсутствовать: каталог /api/workspace/users отдаёт приватные поля
  // только при tenant.users.read (workspaceUserRoutes.ts:80-96). Роль с доступом к
  // каталогу, но без users.read (например, plan-reader в гонке загрузки сессии до того,
  // как AdminFrame закроет раздел) получала undefined → name.trim() ронял всю страницу.
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [accessProfileId, setAccessProfileId] = useState(user.accessProfileId ?? "");
  const [positionId, setPositionId] = useState(user.positionId ?? "");

  const valid = name.trim().length > 0 && email.trim().length > 0 && accessProfileId.length > 0;
  return (
    <FormDialog
      title="Изменить пользователя"
      trigger={<Button variant="ghost" size="sm" disabled={Boolean(disabledReason)} title={disabledReason ?? "Изменить"}><Pencil className="size-3.5" aria-hidden /></Button>}
      // при открытии диалога синхронизируем форму с текущей записью
      onOpenChange={(v) => {
        if (v) { setName(user.name ?? ""); setEmail(user.email ?? ""); setAccessProfileId(user.accessProfileId ?? ""); setPositionId(user.positionId ?? ""); }
      }}
      submitLabel={<><Pencil className="size-3.5" aria-hidden />Сохранить</>}
      submitDisabled={!valid || busy || Boolean(disabledReason)}
      contentClassName="max-w-[480px]"
      successToast={`Пользователь «${name.trim()}» обновлён`}
      // Ошибка остаётся В модалке — раньше уходила строкой позади оверлея (G6-02).
      onSubmit={async () => {
        if (!valid) return null;
        setBusy(true);
        if (disabledReason) return disabledReason;
        // PATCH частичный; смена роли «себе» (user-anna) → self_access_change_forbidden.
        // Смена email (G6-14) проверяется сервером против домен-allowlist политики безопасности.
        const res = await update(user.id, { name: name.trim(), email: email.trim(), accessProfileId, positionId: positionId || null });
        setBusy(false);
        return res.ok ? null : adminErr(res.code, res.message);
      }}
    >
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
          <select value={accessProfileId} onChange={(e) => setAccessProfileId(e.target.value)} className={selCls} disabled={roles.length === 0}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className={labelCls}>Позиция
          <select value={positionId} onChange={(e) => setPositionId(e.target.value)} className={selCls} disabled={positions.length === 0}>
            <option value="">— без позиции —</option>
            {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
    </FormDialog>
  );
}
