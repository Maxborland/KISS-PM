"use client";

import { useMemo, useState } from "react";
import { Archive, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SurfaceState } from "@/components/domain/surface-state";
import { CrmFrame } from "@/crm/ui/crm-frame";
import { StatusChip, crmErr } from "@/crm/ui/crm-bits";
import { useCrm } from "@/crm/lib/use-crm";
import type { Contact } from "@/crm/lib/crm-client";

const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)]";

export function ProjectContacts() {
  const { data, status, error, reload, createContact, updateContact } = useCrm();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const clientById = useMemo(() => new Map((data?.clients ?? []).map((c) => [c.id, c])), [data]);

  // Верхнеуровневый статус поверхности: forbidden/error/loading из хука; пустой справочник → empty; иначе ready.
  const surfaceStatus =
    status === "forbidden"
      ? "forbidden"
      : status === "error"
        ? "error"
        : !data
          ? "loading"
          : data.contacts.length === 0
            ? "empty"
            : "ready";

  // имя клиента + пометка «(архив)», если клиент архивирован (контакт остаётся при архивации клиента)
  const clientLabel = (id: string) => { const cl = clientById.get(id); return cl ? `${cl.name}${cl.status === "archived" ? " (архив)" : ""}` : id; };
  // архив/восстановление шлёт ПОЛНУЮ запись (боевой PATCH — full-replace, требует name)
  const toggleArchive = async (c: Contact, to: "active" | "archived") => {
    setBusy(true); setNotice(null);
    const res = await updateContact(c.id, { clientId: c.clientId, name: c.name, email: c.email, phone: c.phone, telegram: c.telegram, role: c.role, status: to });
    setBusy(false);
    if (res.ok) setNotice(to === "archived" ? "Контакт в архиве" : "Контакт восстановлен");
    else setNotice(`Отклонено: ${crmErr(res.code, res.message)}`);
  };

  return (
    <CrmFrame activeTab="Контакты" subtitle="Справочник контактов" actions={data ? <CreateContactDialog data={data} busy={busy} setBusy={setBusy} setNotice={setNotice} create={createContact} /> : null}>
      <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
        <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
        Реальный контракт CRM: GET/POST/PATCH /api/workspace/contacts. Контакт создаётся только к активному клиенту; email приводится к нижнему регистру и валидируется. Данные in-memory.
      </div>

      <SurfaceState
        status={surfaceStatus}
        error={error}
        onRetry={() => void reload()}
        errorFormat={crmErr}
        loadingLabel="Загрузка контактов…"
        empty={{
          title: "Нет контактов",
          description: "Справочник контактов пуст — создайте первый контакт (нужен активный клиент).",
          action: data ? <CreateContactDialog data={data} busy={busy} setBusy={setBusy} setNotice={setNotice} create={createContact} /> : undefined
        }}
        forbidden={{ title: "Доступ к контактам ограничен", description: "У вас нет прав на просмотр справочника контактов." }}
      >
        <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <thead><tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
              <th className="px-3 py-2 font-semibold">Контакт</th><th className="px-3 py-2 font-semibold">Клиент</th><th className="px-3 py-2 font-semibold">Должность</th><th className="px-3 py-2 font-semibold">Email</th><th className="px-3 py-2 font-semibold">Телефон</th><th className="px-3 py-2 font-semibold">Статус</th><th className="px-3 py-2" />
            </tr></thead>
            <tbody>
              {(data?.contacts ?? []).map((c) => (
                <tr key={c.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-3 py-2"><div className="font-medium text-[var(--text-strong)]">{c.name}</div><div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{c.id}</div></td>
                  <td className="px-3 py-2 text-[var(--muted-strong)]">{clientLabel(c.clientId)}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{c.role ?? "—"}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{c.email ?? "—"}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{c.phone ?? "—"}</td>
                  <td className="px-3 py-2"><StatusChip status={c.status} /></td>
                  <td className="px-3 py-2 text-right">
                    {c.status === "active"
                      ? <Button variant="ghost" size="sm" disabled={busy} onClick={() => void toggleArchive(c, "archived")} title="В архив"><Archive className="size-3.5" aria-hidden /></Button>
                      : <Button variant="ghost" size="sm" disabled={busy} onClick={() => void toggleArchive(c, "active")} title="Восстановить"><RotateCcw className="size-3.5" aria-hidden /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceState>
      {notice ? <div key={notice} className="anim-rise-in-fast mt-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">{notice}</div> : null}
    </CrmFrame>
  );
}

function CreateContactDialog({ data, busy, setBusy, setNotice, create }: { data: NonNullable<ReturnType<typeof useCrm>["data"]>; busy: boolean; setBusy: (v: boolean) => void; setNotice: (v: string | null) => void; create: ReturnType<typeof useCrm>["createContact"] }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const clients = data.clients.filter((c) => c.status === "active");
  const valid = clientId && name.trim();
  const submit = async () => {
    if (!valid) return;
    setBusy(true); setNotice(null);
    const res = await create({ clientId, name: name.trim(), email: email.trim() || null, phone: phone.trim() || null, role: role.trim() || null });
    setBusy(false);
    if (res.ok) { setNotice("Контакт создан"); setOpen(false); setClientId(""); setName(""); setEmail(""); setPhone(""); setRole(""); }
    else setNotice(`Отклонено: ${crmErr(res.code, res.message)}`);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="default" size="sm"><Plus className="size-3.5" aria-hidden />Контакт</Button></DialogTrigger>
      <DialogContent className="max-w-[500px]">
        <DialogHeader><DialogTitle>Новый контакт</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Клиент
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={selCls}><option value="" disabled>Выберите активного клиента…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Имя<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Петрова Анна" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Email<Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anna@example.ru" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Телефон<Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7…" /></label>
          <label className="col-span-2 flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Должность<Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Директор по ИТ" /></label>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
          <Button variant="default" disabled={!valid || busy} onClick={() => void submit()}><Plus className="size-3.5" aria-hidden />Создать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
