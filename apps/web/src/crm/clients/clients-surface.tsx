"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Pencil, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormDialog } from "@/components/domain/form-dialog";
import { Input } from "@/components/ui/input";
import { SurfaceState } from "@/components/domain/surface-state";
import { cn } from "@/lib/cn";
import { CrmFrame } from "@/crm/ui/crm-frame";
import { StatusChip, crmErr, money } from "@/crm/ui/crm-bits";
import { CrmListParamResolver, highlightRowCls, useHighlightRowRef } from "@/crm/ui/list-url-params";
import { getCrmWriteCapability } from "@/crm/ui/permissions";
import { useCrm } from "@/crm/lib/use-crm";
import { useCrmRuntime } from "@/crm/lib/crm-runtime";
import type { Client } from "@/crm/lib/crm-client";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { useSessionUser } from "@/shell/use-session-user";

export function ProjectClients() {
  const { live } = useCrmRuntime();
  const { data, status, error, reload, createClient, updateClient } = useCrm();
  const sessionUser = useSessionUser();
  const createCapability = getCrmWriteCapability({ live, permissions: sessionUser?.permissions ?? [], permission: "tenant.clients.manage" });
  const [busy, setBusy] = useState(false);
  // Deep-link из глобального поиска: `?entity=<id клиента>` подсвечивает строку (Р12).
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightRowRef = useHighlightRowRef(highlightId);

  const model = useMemo(() => {
    if (!data) return null;
    const stats = new Map<string, { deals: number; sum: number; contacts: number }>();
    for (const c of data.clients) stats.set(c.id, { deals: 0, sum: 0, contacts: 0 });
    // «Сделок»/«Сумма» — по сделкам клиента, КРОМЕ проигранных (как воронка/прогноз в Сделках);
    // «Контактов» — только активные (архивные исключаем, как везде в CRM).
    for (const o of data.opportunities) { if (o.status === "lost_rejected") continue; const s = o.clientId ? stats.get(o.clientId) : undefined; if (s) { s.deals += 1; s.sum += o.contractValue; } }
    for (const ct of data.contacts) { if (ct.status !== "active") continue; const s = stats.get(ct.clientId); if (s) s.contacts += 1; }
    return { clients: data.clients, stats };
  }, [data]);
  const clientIds = useMemo(() => new Set((data?.clients ?? []).map((c) => c.id)), [data]);

  // Верхнеуровневый статус поверхности: forbidden/error/loading из хука; пустой справочник → empty; иначе ready.
  const surfaceStatus =
    status === "forbidden"
      ? "forbidden"
      : status === "error"
        ? "error"
        : !data || !model
          ? "loading"
          : model.clients.length === 0
            ? "empty"
            : "ready";

  // архив/восстановление шлёт ПОЛНУЮ запись (боевой PATCH — full-replace, требует name), не только status
  const toggleArchive = async (c: Client, to: "active" | "archived") => {
    setBusy(true);
    const res = await updateClient(c.id, { name: c.name, description: c.description, status: to });
    setBusy(false);
    if (res.ok) toast.success(to === "archived" ? "Клиент в архиве" : "Клиент восстановлен");
    else toast.error(`Отклонено: ${crmErr(res.code, res.message)}`);
  };

  const createClientDialog = <CreateClientDialog busy={busy} setBusy={setBusy} create={createClient} disabledReason={createCapability.disabledReason} />;

  return (
    <CrmFrame activeTab="Клиенты" subtitle="Справочник клиентов" actions={data?.clients.length ? createClientDialog : undefined}>
      {/* Плашка-прототип: только вне live (раньше пряталась display:none и оставалась в DOM). */}
      {!live ? (
      <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
        <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
        Реальный контракт CRM: GET/POST/PATCH /api/workspace/clients (createCrmClient). «Контактов» — активные; «Сделок»/«Сумма» — по сделкам клиента, кроме проигранных. PATCH — полная запись (как боевой). Данные in-memory.
      </div>
      ) : null}

      <SurfaceState
        status={surfaceStatus}
        error={error}
        onRetry={() => void reload()}
        errorFormat={crmErr}
        loadingLabel="Загрузка клиентов…"
        empty={{
          title: "Нет клиентов",
          description: "Справочник клиентов пуст — создайте первого клиента.",
          action: createClientDialog
        }}
        forbidden={{ title: "Доступ к клиентам ограничен", description: "У вас нет прав на просмотр справочника клиентов." }}
      >
        {/* Резолв deep-link ?entity= — только в ready-ветке (SurfaceState рендерит children
            при status==="ready"): useSearchParams вне её требует Suspense при prerender. */}
        <CrmListParamResolver param="entity" knownIds={clientIds} setValue={setHighlightId} notFoundMessage="Клиент не найден: возможно, он удалён или ссылка устарела" />
        <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <thead><tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
              <th className="px-3 py-2 font-semibold">Клиент</th><th className="px-3 py-2 font-semibold">Описание</th><th className="px-3 py-2 text-right font-semibold">Контактов</th><th className="px-3 py-2 text-right font-semibold">Сделок</th><th className="px-3 py-2 text-right font-semibold">Сумма</th><th className="px-3 py-2 font-semibold">Статус</th><th className="px-3 py-2" />
            </tr></thead>
            <tbody>
              {(model?.clients ?? []).map((c) => {
                const s = model?.stats.get(c.id) ?? { deals: 0, sum: 0, contacts: 0 };
                const highlighted = highlightId === c.id;
                // Счётчики контактов/сделок — ссылки на списки с фильтром по клиенту (Р13);
                // ноль — не ссылка: пустой отфильтрованный список не даёт пользы.
                const countCls = "v4-num rounded-[var(--radius-sm)] text-[var(--accent-text)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]";
                return (
                  <tr key={c.id} ref={highlighted ? highlightRowRef : undefined} data-selected={highlighted || undefined} className={cn("v4-row border-b border-[var(--border-subtle)] last:border-0", highlighted && highlightRowCls)}>
                    <td className="px-3 py-2"><div className="font-medium text-[var(--text-strong)]">{c.name}</div>{prototypeNotesEnabled ? <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{c.id}</div> : null}</td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-[var(--muted)]">{c.description ?? "—"}</td>
                    <td className="px-3 py-2 text-right v4-num text-[var(--muted-strong)]">{s.contacts > 0 ? <Link href={`/crm/contacts?client=${encodeURIComponent(c.id)}`} aria-label={`Контакты клиента «${c.name}»`} title="Показать контакты клиента" className={countCls}>{s.contacts}</Link> : s.contacts}</td>
                    <td className="px-3 py-2 text-right v4-num text-[var(--muted-strong)]">{s.deals > 0 ? <Link href={`/crm/deals?client=${encodeURIComponent(c.id)}`} aria-label={`Сделки клиента «${c.name}»`} title="Показать сделки клиента" className={countCls}>{s.deals}</Link> : s.deals}</td>
                    <td className="px-3 py-2 text-right v4-num font-semibold text-[var(--text-strong)]">{s.sum > 0 ? money(s.sum) : "—"}</td>
                    <td className="px-3 py-2"><StatusChip status={c.status} /></td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditClientDialog client={c} busy={busy} setBusy={setBusy} update={updateClient} />
                        {c.status === "active"
                          ? (
                            // Архивирование — только через подтверждение (G4-19).
                            <ConfirmDialog
                              title={`Архивировать «${c.name}»?`}
                              description="Запись будет перенесена в архив."
                              confirmLabel="В архив"
                              onConfirm={() => toggleArchive(c, "archived")}
                            >
                              <Button variant="ghost" size="sm" disabled={busy} title="В архив"><Archive className="size-3.5" aria-hidden /></Button>
                            </ConfirmDialog>
                          )
                          : <Button variant="ghost" size="sm" disabled={busy} onClick={() => void toggleArchive(c, "active")} title="Восстановить"><RotateCcw className="size-3.5" aria-hidden /></Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SurfaceState>
    </CrmFrame>
  );
}

// Редактирование клиента (G4-07): управляемый диалог по образцу EditUserDialog, форма синхронизируется при открытии.
function EditClientDialog({ client, busy, setBusy, update }: { client: Client; busy: boolean; setBusy: (v: boolean) => void; update: ReturnType<typeof useCrm>["updateClient"] }) {
  const [name, setName] = useState(client.name);
  const [description, setDescription] = useState(client.description ?? "");
  return (
    <FormDialog
      title="Изменить клиента"
      trigger={<Button variant="ghost" size="sm" disabled={busy} title="Изменить"><Pencil className="size-3.5" aria-hidden /></Button>}
      // при открытии диалога синхронизируем форму с текущей записью
      onOpenChange={(v) => { if (v) { setName(client.name); setDescription(client.description ?? ""); } }}
      submitLabel={<><Pencil className="size-3.5" aria-hidden />Сохранить</>}
      submitDisabled={!name.trim() || busy}
      successToast={`Клиент «${name.trim()}» обновлён`}
      contentClassName="max-w-[460px]"
      // Ошибка остаётся В модалке — по месту действия.
      onSubmit={async () => {
        if (!name.trim()) return null;
        setBusy(true);
        // PATCH — полная запись (боевой full-replace); статус не меняем — сохраняем текущий.
        const res = await update(client.id, { name: name.trim(), description: description.trim() || null, status: client.status });
        setBusy(false);
        return res.ok ? null : crmErr(res.code, res.message);
      }}
    >
      <div className="flex flex-col gap-3">
        {prototypeNotesEnabled ? (
          <div className="flex flex-col gap-0.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] px-2.5 py-1.5">
            <span className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{client.id}</span>
          </div>
        ) : null}
        <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Название<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ООО «Ромашка»" /></label>
        <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Описание<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="необязательно" /></label>
      </div>
    </FormDialog>
  );
}

function CreateClientDialog({ busy, setBusy, create, disabledReason }: { busy: boolean; setBusy: (v: boolean) => void; create: ReturnType<typeof useCrm>["createClient"]; disabledReason?: string | null }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <FormDialog
      title="Новый клиент"
      trigger={<Button variant="default" size="sm" disabled={busy || Boolean(disabledReason)} title={disabledReason ?? "Создать клиента"}><Plus className="size-3.5" aria-hidden />Клиент</Button>}
      submitLabel={<><Plus className="size-3.5" aria-hidden />Создать</>}
      submitDisabled={!name.trim() || busy}
      successToast="Клиент создан"
      contentClassName="max-w-[460px]"
      // Ошибка остаётся В модалке — раньше уходила строкой внизу страницы.
      onSubmit={async () => {
        if (!name.trim()) return null;
        setBusy(true);
        const res = await create({ name: name.trim(), description: description.trim() || null });
        setBusy(false);
        return res.ok ? null : crmErr(res.code, res.message);
      }}
      onSuccess={() => { setName(""); setDescription(""); }}
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Название<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ООО «Ромашка»" /></label>
        <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Описание<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="необязательно" /></label>
      </div>
    </FormDialog>
  );
}
