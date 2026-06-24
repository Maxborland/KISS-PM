"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, LogOut } from "lucide-react";

import { BemAvatar, type BemAvatarColor } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { SurfaceState } from "@/components/domain/surface-state";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { cn } from "@/lib/cn";
import { authErr, FormError } from "@/auth/lib/auth-bits";
import { useAuth } from "@/auth/lib/use-auth";
import type { ProfileUpdateInput, ThemeUpdateInput, WorkspaceUser } from "@/auth/lib/auth-client";

/* ============================================================
   ЛК/Профиль (authenticated) — внутренний экран рабочего пространства.
   Каркас: WorkspaceShell (левая навигация + топбар), НЕ unauth-карточка.

   ЧЕСТНОСТЬ:
   - Баннер «Прототип»: contract-mock, переключение на боевой = apiOrigin;
     данные in-memory.
   - Демо: мок стартует anonymous, поэтому на монтаже делаем авто-вход
     демо-кредами ОДИН раз (честная плашка «Демо: выполнен вход админом»).
   - Все ошибки форматируем через authErr (errorFormat / FormError).

   Контракт: GET /api/auth/me (полный WorkspaceUser + permissions),
   PATCH /api/profile (правка подмножества полей) — оба БОЕВЫЕ.
   ============================================================ */

// Инициалы из имени (по образцу deals-surface): первые буквы 1-2 слов.
const initials = (name: string) => {
  const p = name.replace(/[«»"]/g, "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—";
};

// Детерминированный цвет аватара по имени (стабилен между рендерами).
const avatarColor = (name: string): BemAvatarColor => {
  const colors: BemAvatarColor[] = ["c1", "c2", "c3", "c4", "c5"];
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return colors[h % colors.length]!;
};

// Боевой isWorkspaceTheme допускает ТОЛЬКО light|dark (НЕ system).
const THEME_LABEL: Record<WorkspaceUser["theme"], string> = {
  light: "Светлая",
  dark: "Тёмная"
};

// Демо-креды активного админа (§5 сид).
const DEMO_EMAIL = "admin@kiss-pm.local";
const DEMO_PASSWORD = "kiss-pm-admin";

const selCls =
  "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)]";
const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";

export function ProfileSurface() {
  // ЕДИНЫЙ useAuth: вход + профиль (user из me) + права + правка — одна мок-сессия.
  // (Раздельный useProfile создавал бы ОТДЕЛЬНУЮ изолированную сессию → 401.)
  const { state, status, error, user, permissions, login, logout, reload, updateProfile, updateTheme } = useAuth();

  // Авто-вход демо-кредами ОДИН раз (мок стартует anonymous). useRef — защита от StrictMode-двойного эффекта.
  const autoLoginRef = useRef(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    if (autoLoginRef.current) return;
    autoLoginRef.current = true;
    void (async () => {
      await login(DEMO_EMAIL, DEMO_PASSWORD); // login сам рефетчит me → authenticated
      setBootstrapping(false);
    })();
    // login стабилен (useCallback), эффект — единожды на монтаж.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    await logout();
    setLoggedOut(true);
  }

  const profileUser: WorkspaceUser | null = user && "email" in user ? (user as WorkspaceUser) : null;

  // После выхода — честно forbidden (сессии нет).
  if (loggedOut) {
    return (
      <WorkspaceShell activeNav="Профиль">
        <main className="min-w-0 flex-1 overflow-auto p-4">
          <ProtoBanner />
          <SurfaceState
            status="forbidden"
            forbidden={{
              title: "Вы вышли из системы",
              description: "Сессия завершена. В рабочем приложении откроется экран входа.",
              action: (
                <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                  Войти снова
                </Button>
              )
            }}
          >
            <span />
          </SurfaceState>
        </main>
      </WorkspaceShell>
    );
  }

  // Статус ЛК: пока идёт авто-вход/рефетч — loading; ошибка сети — error; нет сессии — forbidden; иначе — ready.
  const surfaceStatus =
    bootstrapping || status === "loading"
      ? "loading"
      : status === "error"
        ? "error"
        : state === "authenticated" && profileUser
          ? "ready"
          : "forbidden";

  return (
    <WorkspaceShell activeNav="Профиль">
      <main className="min-w-0 flex-1 overflow-auto p-4">
        <ProtoBanner />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Личный кабинет</h1>
            <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Профиль и настройки рабочего пространства</p>
          </div>
          {state === "authenticated" ? (
            <Button variant="destructive-soft" size="sm" onClick={() => void handleLogout()}>
              <LogOut className="size-3.5" aria-hidden />
              Выйти
            </Button>
          ) : null}
        </div>

        {/* Честная плашка про авто-вход (демо). */}
        <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">
            Демо
          </span>
          <span>Выполнен вход админом ({DEMO_EMAIL}) — мок стартует анонимно, поэтому сессия открыта автоматически. GET /api/auth/me отдаёт профиль ниже.</span>
        </div>

        <SurfaceState
          status={surfaceStatus}
          error={error}
          onRetry={() => void reload()}
          loadingLabel="Демо: выполняем вход админом…"
          errorFormat={authErr}
          forbidden={{
            title: "Требуется вход в систему",
            description: "Сессия не найдена — войдите, чтобы открыть профиль."
          }}
        >
          {profileUser ? (
            <ProfileContent user={profileUser} permissions={permissions} update={updateProfile} updateTheme={updateTheme} />
          ) : (
            <span />
          )}
        </SurfaceState>
      </main>
    </WorkspaceShell>
  );
}

// Баннер честности «Прототип» (зеркало deals-surface).
function ProtoBanner() {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--text-strong)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">
        Прототип
      </span>
      <span>
        Боевой контракт: GET /api/auth/me + PATCH /api/profile (имя, телефон, Telegram) + PATCH /api/profile/theme (тема, акцентный цвет).
        Транспорт — contract-mock; переключение на боевой = apiOrigin. Данные in-memory.
      </span>
    </div>
  );
}

// Контент ЛК: карточка профиля + форма правки.
function ProfileContent({
  user,
  permissions,
  update,
  updateTheme
}: {
  user: WorkspaceUser;
  permissions: string[];
  update: ReturnType<typeof useAuth>["updateProfile"];
  updateTheme: ReturnType<typeof useAuth>["updateTheme"];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
      <ProfileCard user={user} permissions={permissions} />
      <ProfileForm user={user} update={update} updateTheme={updateTheme} />
    </div>
  );
}

// Карточка профиля: аватар + имя + email + роль/права.
function ProfileCard({ user, permissions }: { user: WorkspaceUser; permissions: string[] }) {
  return (
    <aside className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <BemAvatar initials={initials(user.name)} color={avatarColor(user.name)} size="xl" />
        <div className="min-w-0">
          <div className="truncate text-[length:var(--text-md)] font-bold text-[var(--text-strong)]">{user.name}</div>
          <div className="truncate text-[length:var(--text-sm)] text-[var(--muted)]">{user.email}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip variant={user.status === "active" ? "success" : "danger"}>{user.status === "active" ? "Активен" : "Отключён"}</Chip>
        {user.positionName ? <Chip variant="info">{user.positionName}</Chip> : null}
      </div>

      <dl className="flex flex-col gap-2 text-[length:var(--text-xs)]">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--muted-soft)]">Рабочее пространство</dt>
          <dd className="v4-mono text-[var(--muted-strong)]">{user.tenantId}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--muted-soft)]">Профиль доступа</dt>
          <dd className="v4-mono text-[var(--muted-strong)]">{user.accessProfileId}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--muted-soft)]">Тема / акцент</dt>
          <dd className="flex items-center gap-1.5 text-[var(--muted-strong)]">
            {THEME_LABEL[user.theme]}
            <span className="inline-block size-3 rounded-full border border-[var(--border)]" style={{ backgroundColor: user.accentColor }} aria-hidden />
            <span className="v4-mono">{user.accentColor}</span>
          </dd>
        </div>
      </dl>

      <div className="border-t border-[var(--border-subtle)] pt-2">
        <div className="mb-1.5 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.04em] text-[var(--muted-soft)]">Права (permissions)</div>
        <PermissionsList permissions={permissions} />
      </div>
    </aside>
  );
}

// Список прав текущего пользователя (передаётся из единого useAuth — не отдельная сессия).
function PermissionsList({ permissions }: { permissions: string[] }) {
  if (permissions.length === 0) return <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Права не назначены.</p>;
  return (
    <ul className="flex flex-wrap gap-1">
      {permissions.map((p) => (
        <li key={p} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel-subtle)] px-1.5 py-0.5 v4-mono text-[10px] text-[var(--muted-strong)]">
          {p}
        </li>
      ))}
    </ul>
  );
}

// Форма правки профиля → ДВЕ боевые ручки:
//   PATCH /api/profile      (name/phone/telegram, update)
//   PATCH /api/profile/theme (theme/accentColor,   updateTheme)
// Шлём только изменённую группу; если менялись обе — зовём обе и объединяем результат.
function ProfileForm({
  user,
  update,
  updateTheme
}: {
  user: WorkspaceUser;
  update: ReturnType<typeof useAuth>["updateProfile"];
  updateTheme: ReturnType<typeof useAuth>["updateTheme"];
}) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [telegram, setTelegram] = useState(user.telegram ?? "");
  const [theme, setTheme] = useState<WorkspaceUser["theme"]>(user.theme);
  const [accentColor, setAccentColor] = useState(user.accentColor);

  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Синхронизация формы с сервером после успешного PATCH (user обновляется через рефетч me).
  useEffect(() => {
    setName(user.name);
    setPhone(user.phone ?? "");
    setTelegram(user.telegram ?? "");
    setTheme(user.theme);
    setAccentColor(user.accentColor);
  }, [user]);

  // Дельта профиля (PATCH /api/profile): name/phone/telegram (пустая строка → null).
  const profileDiff = useMemo<ProfileUpdateInput>(() => {
    const out: ProfileUpdateInput = {};
    const trimmedName = name.trim();
    if (trimmedName !== user.name) out.name = trimmedName;
    const phoneVal = phone.trim() === "" ? null : phone.trim();
    if (phoneVal !== user.phone) out.phone = phoneVal;
    const tgVal = telegram.trim() === "" ? null : telegram.trim();
    if (tgVal !== user.telegram) out.telegram = tgVal;
    return out;
  }, [name, phone, telegram, user]);

  // Дельта темы (PATCH /api/profile/theme): theme/accentColor.
  const themeDiff = useMemo<ThemeUpdateInput>(() => {
    const out: ThemeUpdateInput = {};
    if (theme !== user.theme) out.theme = theme;
    if (accentColor !== user.accentColor) out.accentColor = accentColor;
    return out;
  }, [theme, accentColor, user]);

  const profileChanged = Object.keys(profileDiff).length > 0;
  const themeChanged = Object.keys(themeDiff).length > 0;
  const changedCount = Object.keys(profileDiff).length + Object.keys(themeDiff).length;
  const dirty = changedCount > 0;
  const accentValid = /^#[0-9a-fA-F]{6}$/.test(accentColor);
  const canSave = dirty && !busy && name.trim().length > 0 && accentValid;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setErrorCode(null);
    setSaved(false);
    // Разносим по ручкам: профиль и тема — раздельно; обе группы → обе ручки.
    // Первая ошибка любой ручки останавливает сохранение и показывается через FormError.
    let failureCode: string | null = null;
    if (profileChanged) {
      const res = await update(profileDiff);
      if (!res.ok) failureCode = res.code ?? res.message;
    }
    if (failureCode === null && themeChanged) {
      const res = await updateTheme(themeDiff);
      if (!res.ok) failureCode = res.code ?? res.message;
    }
    setBusy(false);
    if (failureCode !== null) setErrorCode(failureCode);
    else setSaved(true);
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]"
      noValidate
      onSubmit={(e) => void submit(e)}
    >
      <div>
        <h2 className="text-[length:var(--text-md)] font-semibold text-[var(--text-strong)]">Редактирование профиля</h2>
        <p className="text-[length:var(--text-xs)] text-[var(--muted)]">PATCH /api/profile (имя/телефон/Telegram) и /api/profile/theme (тема/цвет) — только изменённые поля.</p>
      </div>

      <FormError code={errorCode} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={cn(labelCls, "sm:col-span-2")}>
          Имя
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя сотрудника" aria-invalid={name.trim().length === 0} />
        </label>

        <label className={labelCls}>
          Телефон
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 999 000-00-00" inputMode="tel" />
        </label>

        <label className={labelCls}>
          Telegram
          <Input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" />
        </label>

        <label className={labelCls}>
          Тема оформления
          <select value={theme} onChange={(e) => setTheme(e.target.value as WorkspaceUser["theme"])} className={selCls}>
            <option value="light">Светлая</option>
            <option value="dark">Тёмная</option>
          </select>
        </label>

        <label className={labelCls}>
          Акцентный цвет
          <span className="flex items-center gap-2">
            <input
              type="color"
              value={accentValid ? accentColor : "#0f766e"}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-9 w-12 shrink-0 cursor-pointer rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] p-0.5"
              aria-label="Выбрать акцентный цвет"
            />
            <Input
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              placeholder="#0f766e"
              aria-invalid={!accentValid}
              className="v4-mono"
            />
          </span>
          {!accentValid ? <span className="text-[10px] text-[var(--danger-text)]">Формат: #RRGGBB</span> : null}
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
        <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">
          {dirty ? `Изменено полей: ${changedCount}` : "Нет изменений"}
        </span>
        <span className="flex items-center gap-2">
          {saved ? (
            <span className="inline-flex items-center gap-1 text-[length:var(--text-xs)] font-medium text-[var(--success-text)]">
              <Check className="size-3.5" aria-hidden />
              Сохранено
            </span>
          ) : null}
          <Button type="submit" variant="default" size="sm" disabled={!canSave}>
            {busy ? "Сохранение…" : "Сохранить"}
          </Button>
        </span>
      </div>
    </form>
  );
}
