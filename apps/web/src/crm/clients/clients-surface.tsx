"use client";

import { useMemo, useState } from "react";
import { Archive, Pencil, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SurfaceState } from "@/components/domain/surface-state";
import { CrmFrame } from "@/crm/ui/crm-frame";
import { StatusChip, crmErr, money } from "@/crm/ui/crm-bits";
import { useCrm } from "@/crm/lib/use-crm";
import { useCrmRuntime } from "@/crm/lib/crm-runtime";
import type { Client } from "@/crm/lib/crm-client";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

// Ошибка внутри модалки — по месту действия (раньше рендерилась строкой внизу страницы).
function DialogError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft,var(--panel-subtle))] px-2.5 py-1.5 text-[length:var(--text-xs)] text-[var(--danger-text,var(--danger))]">
      {text}
    </p>
  );
}

export function ProjectClients() {
  const { live } = useCrmRuntime();
  const { data, status, error, reload, createClient, updateClient } = useCrm();
  const [busy, setBusy] = useState(false);

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

  return (
    <CrmFrame activeTab="Клиенты" subtitle="Справочник клиентов" actions={<CreateClientDialog busy={busy} setBusy={setBusy} create={createClient} />}>
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
          action: <CreateClientDialog busy={busy} setBusy={setBusy} create={createClient} />
        }}
        forbidden={{ title: "Доступ к клиентам ограничен", description: "У вас нет прав на просмотр справочника клиентов." }}
      >
        <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <thead><tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
              <th className="px-3 py-2 font-semibold">Клиент</th><th className="px-3 py-2 font-semibold">Описание</th><th className="px-3 py-2 text-right font-semibold">Контактов</th><th className="px-3 py-2 text-right font-semibold">Сделок</th><th className="px-3 py-2 text-right font-semibold">Сумма</th><th className="px-3 py-2 font-semibold">Статус</th><th className="px-3 py-2" />
            </tr></thead>
            <tbody>
              {(model?.clients ?? []).map((c) => {
                const s = model?.stats.get(c.id) ?? { deals: 0, sum: 0, contacts: 0 };
                return (
                  <tr key={c.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-3 py-2"><div className="font-medium text-[var(--text-strong)]">{c.name}</div>{prototypeNotesEnabled ? <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{c.id}</div> : null}</td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-[var(--muted)]">{c.description ?? "—"}</td>
                    <td className="px-3 py-2 text-right v4-num text-[var(--muted-strong)]">{s.contacts}</td>
                    <td className="px-3 py-2 text-right v4-num text-[var(--muted-strong)]">{s.deals}</td>
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
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(client.name);
  const [description, setDescription] = useState(client.description ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  // при открытии диалога синхронизируем форму с текущей записью
  const onOpenChange = (v: boolean) => {
    if (v) { setName(client.name); setDescription(client.description ?? ""); setFormError(null); }
    setOpen(v);
  };
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true); setFormError(null);
    // PATCH — полная запись (боевой full-replace); статус не меняем — сохраняем текущий.
    const res = await update(client.id, { name: name.trim(), description: description.trim() || null, status: client.status });
    setBusy(false);
    if (res.ok) { toast.success(`Клиент «${name.trim()}» обновлён`); setOpen(false); }
    // Ошибка остаётся В модалке — по месту действия.
    else setFormError(crmErr(res.code, res.message));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button variant="ghost" size="sm" disabled={busy} title="Изменить"><Pencil className="size-3.5" aria-hidden /></Button></DialogTrigger>
      <DialogContent className="max-w-[460px]">
        <DialogHeader><DialogTitle>Изменить клиента</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          {prototypeNotesEnabled ? (
            <div className="flex flex-col gap-0.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] px-2.5 py-1.5">
              <span className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{client.id}</span>
            </div>
          ) : null}
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Название<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ООО «Ромашка»" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Описание<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="необязательно" /></label>
          <DialogError text={formError} />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
          <Button variant="default" disabled={!name.trim() || busy} onClick={() => void submit()}><Pencil className="size-3.5" aria-hidden />Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateClientDialog({ busy, setBusy, create }: { busy: boolean; setBusy: (v: boolean) => void; create: ReturnType<typeof useCrm>["createClient"] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true); setFormError(null);
    const res = await create({ name: name.trim(), description: description.trim() || null });
    setBusy(false);
    if (res.ok) { toast.success("Клиент создан"); setOpen(false); setName(""); setDescription(""); }
    // Ошибка остаётся В модалке — раньше уходила строкой внизу страницы.
    else setFormError(crmErr(res.code, res.message));
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setFormError(null); }}>
      <DialogTrigger asChild><Button variant="default" size="sm"><Plus className="size-3.5" aria-hidden />Клиент</Button></DialogTrigger>
      <DialogContent className="max-w-[460px]">
        <DialogHeader><DialogTitle>Новый клиент</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Название<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ООО «Ромашка»" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Описание<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="необязательно" /></label>
          <DialogError text={formError} />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
          <Button variant="default" disabled={!name.trim() || busy} onClick={() => void submit()}><Plus className="size-3.5" aria-hidden />Создать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
