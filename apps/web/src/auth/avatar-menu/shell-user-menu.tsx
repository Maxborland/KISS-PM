"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";

import { AuthRuntimeProvider } from "@/auth/lib/auth-runtime";
import { useAuth } from "@/auth/lib/use-auth";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Меню пользователя в топ-баре рабочей области: аватар → «Профиль» + «Выйти».
 * Оборачиваем в AuthRuntimeProvider live, чтобы useAuth ходил в БОЕВОЙ /api/auth/me
 * (cookie общая → реальная сессия), а не в mock — иначе имя/выход не работают в чроме.
 */
export function ShellUserMenu() {
  return (
    <AuthRuntimeProvider live>
      <ShellUserMenuInner />
    </AuthRuntimeProvider>
  );
}

function ShellUserMenuInner() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const name = user?.name ?? "Пользователь";

  async function doLogout() {
    setBusy(true);
    await logout();
    setBusy(false);
    setOpen(false);
    window.location.replace("/login");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={name}
        className="grid size-8 place-items-center rounded-full bg-[var(--accent-soft)] text-[length:var(--text-xs)] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white [@media(pointer:coarse)]:size-[var(--touch-target)]"
      >
        {initials(name)}
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div role="menu" className="absolute right-0 z-20 mt-1.5 w-52 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
            <div className="border-b border-[var(--border)] px-3 py-2">
              <div className="truncate text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">{name}</div>
              {user?.id ? <div className="truncate text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{user.id}</div> : null}
            </div>
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-[length:var(--text-sm)] text-[var(--muted-strong)] hover:bg-[var(--panel-subtle)] [@media(pointer:coarse)]:min-h-[var(--touch-target)]"
            >
              <User className="size-4" aria-hidden /> Профиль
            </Link>
            {/* /settings была недостижима из UI (G2-16) — настройки уведомлений и пр. */}
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-[length:var(--text-sm)] text-[var(--muted-strong)] hover:bg-[var(--panel-subtle)] [@media(pointer:coarse)]:min-h-[var(--touch-target)]"
            >
              <Settings className="size-4" aria-hidden /> Настройки
            </Link>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => void doLogout()}
              className="flex w-full items-center gap-2 px-3 py-2 text-[length:var(--text-sm)] text-[var(--danger,var(--text-strong))] hover:bg-[var(--panel-subtle)] disabled:opacity-60 [@media(pointer:coarse)]:min-h-[var(--touch-target)]"
            >
              <LogOut className="size-4" aria-hidden /> {busy ? "Выходим…" : "Выйти"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
