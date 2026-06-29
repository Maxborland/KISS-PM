"use client";

import { useMemo, useState } from "react";
import { Bot, Check, ChevronRight, ShieldCheck, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SurfaceState } from "@/components/domain/surface-state";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { useMyWork, useWorkspaceTaskStatuses } from "@/workspace/lib/use-workspace";
import type { TaskRecord } from "@/workspace/lib/workspace-client";

// «Продвинуть работу»: прямой forward-путь по категориям статусов (подмножество боевого
// ALLOWED_TRANSITIONS — только безопасное движение вперёд). done → дальше некуда.
const FORWARD: Record<string, string> = {
  new: "in_progress",
  waiting: "in_progress",
  in_progress: "review",
  review: "done",
  done: ""
};

type Proposal = { task: TaskRecord; from: { id: string; name: string }; to: { id: string; name: string } };

/**
 * Агент — альтернативный способ ведения работы: анализирует задачи пользователя
 * (GET /api/workspace/my-work) и предлагает безопасные действия (перевод задачи в
 * следующий статус по разрешённым переходам). Применение — ТОЛЬКО после подтверждения,
 * боевым PATCH /api/workspace/projects/:id/tasks/:taskId/status (тот же контракт, что
 * канбан «Моей работы»). Транспорт — WorkspaceRuntime (live/mock).
 */
export function AgentSurface() {
  const myWork = useMyWork();
  const statuses = useWorkspaceTaskStatuses();
  const [busy, setBusy] = useState(false);
  const [confirmTaskId, setConfirmTaskId] = useState<string | null>(null);
  const [log, setLog] = useState<{ key: string; text: string }[]>([]);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const statusList = statuses.list;

  // Безопасные предложения: для каждой задачи — доступный forward-переход (исключая done).
  const proposals: Proposal[] = useMemo(() => {
    const tasks = myWork.data?.tasks ?? [];
    return tasks.flatMap((task) => {
      const from = statuses.byId.get(task.statusId);
      if (!from) return [];
      const nextCat = FORWARD[from.category];
      const to = nextCat ? statusList.find((s) => s.category === nextCat) : undefined;
      if (!to) return [];
      return [{ task, from: { id: from.id, name: from.name }, to: { id: to.id, name: to.name } }];
    });
  }, [myWork.data, statuses.byId, statusList]);

  const surfaceStatus =
    myWork.status === "loading" ? "loading" : myWork.status === "error" ? "error" : "ready";

  const apply = async (proposal: Proposal) => {
    setBusy(true);
    setNotice(null);
    const res = await myWork.updateTaskStatus(proposal.task.id, proposal.to.id);
    setBusy(false);
    setConfirmTaskId(null);
    if (res.ok) {
      setLog((l) => [{ key: `${proposal.task.id}-${l.length}`, text: `«${proposal.task.title}»: ${proposal.from.name} → ${proposal.to.name}` }, ...l]);
      setNotice({ ok: true, text: "Предложение применено" });
      await myWork.reload();
    } else {
      setNotice({ ok: false, text: `Отклонено: ${res.code ?? res.message}` });
    }
  };

  return (
    <WorkspaceShell activeNav="Агент">
      <main className="min-w-0 flex-1 overflow-auto bg-[var(--canvas)] p-4 md:p-6">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]"><Bot className="size-5" aria-hidden /></span>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-[length:var(--text-22)] font-extrabold leading-tight tracking-[-0.025em] text-[var(--text-strong)]">Агент</h1>
            <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Анализирует ваши задачи и предлагает безопасные действия. Без подтверждения ничего не меняется.</p>
          </div>
        </div>

        <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          <span>Реальный контракт: GET /api/workspace/my-work + PATCH /api/workspace/projects/:id/tasks/:taskId/status. Агент предлагает только разрешённые переходы (ALLOWED_TRANSITIONS) и применяет их по подтверждению (createWorkspaceClient + in-memory mock, swap = apiOrigin).</span>
        </div>

        <SurfaceState status={surfaceStatus} error={myWork.error} onRetry={() => void myWork.reload()}>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
            {/* Предложения агента */}
            <section className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">
                <ShieldCheck className="size-4 text-[var(--success-text)]" aria-hidden />
                Безопасные предложения
                <Chip variant="info">{proposals.length}</Chip>
              </div>
              {proposals.length === 0 ? (
                <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border)] bg-[var(--panel-subtle)] px-4 py-8 text-center text-[length:var(--text-sm)] text-[var(--muted-soft)]">
                  Сейчас нет безопасных действий — задачи в финальных статусах или ждут вашего решения.
                </div>
              ) : (
                proposals.map((p) => {
                  const confirming = confirmTaskId === p.task.id;
                  return (
                    <article key={p.task.id} className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-3.5 shadow-[var(--shadow-card)]">
                      <div className="flex items-center gap-2 text-[length:var(--text-sm)]">
                        <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-strong)]">{p.task.title}</span>
                        <span className="inline-flex items-center gap-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
                          {p.from.name}<ChevronRight className="size-3.5 text-[var(--muted-soft)]" aria-hidden />
                          <span className="font-semibold text-[var(--accent-text)]">{p.to.name}</span>
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        {!confirming ? (
                          <Button variant="outline" size="sm" disabled={busy} onClick={() => { setConfirmTaskId(p.task.id); setNotice(null); }}>
                            Подготовить предложение
                          </Button>
                        ) : (
                          <>
                            <span className="text-[length:var(--text-xs)] text-[var(--muted)]">Подтвердите — до этого изменение не отправляется.</span>
                            <span className="ml-auto flex items-center gap-2">
                              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmTaskId(null)}>Отмена</Button>
                              <Button variant="default" size="sm" disabled={busy} onClick={() => void apply(p)}>
                                <Check className="size-3.5" aria-hidden />Подтвердить
                              </Button>
                            </span>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
              {notice ? (
                <div {...(notice.ok ? {} : { role: "alert" })} className={`anim-rise-in-fast inline-flex items-center gap-1.5 text-[length:var(--text-xs)] ${notice.ok ? "text-[var(--muted-strong)]" : "text-[var(--danger-text)]"}`}>
                  {notice.ok ? <Check className="size-3.5 text-[var(--success-text)]" aria-hidden /> : <TriangleAlert className="size-3.5" aria-hidden />}
                  {notice.text}
                </div>
              ) : null}
            </section>

            {/* Лог применённых действий за сессию */}
            <aside className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-3.5 shadow-[var(--shadow-card)]">
              <div className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Действия агента</div>
              {log.length === 0 ? (
                <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Пока ничего не применено.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {log.map((entry) => (
                    <li key={entry.key} className="flex items-start gap-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
                      <Check className="mt-0.5 size-3 shrink-0 text-[var(--success-text)]" aria-hidden />
                      <span>{entry.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        </SurfaceState>
      </main>
    </WorkspaceShell>
  );
}
