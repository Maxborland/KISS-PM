import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Страница не найдена — KISS PM" };

// 404 на токенах design v4 (старые BEM-классы app-canvas/* здесь не подключены —
// вёрстка разваливалась в одну строку поверх пустой карточки, G2-04).
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--canvas)] p-6">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-6 py-8 text-center shadow-[var(--shadow-card)]">
        <span className="font-[family-name:var(--font-display)] text-[length:var(--text-22)] font-extrabold text-[var(--text-strong)]">404</span>
        <h1 className="text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Страница не найдена</h1>
        <p className="text-[length:var(--text-sm)] text-[var(--muted)]">
          Такого адреса нет: возможно, ссылка устарела или в ней опечатка.
        </p>
        <Link
          href="/"
          className="mt-2 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-[length:var(--text-sm)] font-semibold text-white transition-opacity hover:opacity-90"
        >
          В рабочую область
        </Link>
      </div>
    </main>
  );
}
