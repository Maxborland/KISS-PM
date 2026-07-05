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
import { StatusChip, crmErr } from "@/crm/ui/crm-bits";
import { useCrm } from "@/crm/lib/use-crm";
import type { Contact } from "@/crm/lib/crm-client";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)]";

// Ошибка внутри модалки — по месту действия (раньше рендерилась строкой внизу страницы).
function DialogError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft,var(--panel-subtle))] px-2.5 py-1.5 text-[length:var(--text-xs)] text-[var(--danger-text,var(--danger))]">
      {text}
    </p>
  );
}

export function ProjectContacts() {
  const { data, status, error, reload, createContact, updateContact } = useCrm();
  const [busy, setBusy] = useState(false);

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

  // имя клиента + пометка «(архив)», если клиент архивирован (контакт остаётся при архивации клиента).
  // Если клиент не нашёлся в справочнике — читабельный фолбэк вместо сырого id (по образцу «Участник xxxx»).
  const clientLabel = (id: string) => { const cl = clientById.get(id); return cl ? `${cl.name}${cl.status === "archived" ? " (архив)" : ""}` : `Клиент ${id.slice(-4)}`; };
  // архив/восстановление шлёт ПОЛНУЮ запись (боевой PATCH — full-replace, требует name)
  const toggleArchive = async (c: Contact, to: "active" | "archived") => {
    setBusy(true);
    const res = await updateContact(c.id, { clientId: c.clientId, name: c.name, email: c.email, phone: c.phone, telegram: c.telegram, role: c.role, status: to });
    setBusy(false);
    if (res.ok) toast.success(to === "archived" ? "Контакт в архиве" : "Контакт восстановлен");
    else toast.error(`Отклонено: ${crmErr(res.code, res.message)}`);
  };

  return (
    <CrmFrame activeTab="Контакты" subtitle="Справочник контактов" actions={data ? <CreateContactDialog data={data} busy={busy} setBusy={setBusy} create={createContact} /> : null}>
      {prototypeNotesEnabled && (
        <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          Реальный контракт CRM: GET/POST/PATCH /api/workspace/contacts. Контакт создаётся только к активному клиенту; email приводится к нижнему регистру и валидируется. Данные in-memory.
        </div>
      )}

      <SurfaceState
        status={surfaceStatus}
        error={error}
        onRetry={() => void reload()}
        errorFormat={crmErr}
        loadingLabel="Загрузка контактов…"
        empty={{
          title: "Нет контактов",
          description: "Справочник контактов пуст — создайте первый контакт (нужен активный клиент).",
          action: data ? <CreateContactDialog data={data} busy={busy} setBusy={setBusy} create={createContact} /> : undefined
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
                  <td className="px-3 py-2"><div className="font-medium text-[var(--text-strong)]">{c.name}</div>{prototypeNotesEnabled ? <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{c.id}</div> : null}</td>
                  <td className="px-3 py-2 text-[var(--muted-strong)]">{clientLabel(c.clientId)}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{c.role ?? "—"}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{c.email ?? "—"}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{c.phone ?? "—"}</td>
                  <td className="px-3 py-2"><StatusChip status={c.status} /></td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <EditContactDialog contact={c} clientName={clientLabel(c.clientId)} busy={busy} setBusy={setBusy} update={updateContact} />
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
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceState>
    </CrmFrame>
  );
}

// Редактирование контакта (G4-07): управляемый диалог по образцу EditUserDialog; клиент НЕ меняется (показан справочно).
function EditContactDialog({ contact, clientName, busy, setBusy, update }: { contact: Contact; clientName: string; busy: boolean; setBusy: (v: boolean) => void; update: ReturnType<typeof useCrm>["updateContact"] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [telegram, setTelegram] = useState(contact.telegram ?? "");
  const [role, setRole] = useState(contact.role ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  // при открытии диалога синхронизируем форму с текущей записью
  const onOpenChange = (v: boolean) => {
    if (v) { setName(contact.name); setEmail(contact.email ?? ""); setPhone(contact.phone ?? ""); setTelegram(contact.telegram ?? ""); setRole(contact.role ?? ""); setFormError(null); }
    setOpen(v);
  };
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true); setFormError(null);
    // PATCH — полная запись (боевой full-replace); clientId и статус не меняем — сохраняем текущие.
    const res = await update(contact.id, { clientId: contact.clientId, name: name.trim(), email: email.trim() || null, phone: phone.trim() || null, telegram: telegram.trim() || null, role: role.trim() || null, status: contact.status });
    setBusy(false);
    if (res.ok) { toast.success(`Контакт «${name.trim()}» обновлён`); setOpen(false); }
    // Ошибка остаётся В модалке — по месту действия.
    else setFormError(crmErr(res.code, res.message));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button variant="ghost" size="sm" disabled={busy} title="Изменить"><Pencil className="size-3.5" aria-hidden /></Button></DialogTrigger>
      <DialogContent className="max-w-[500px]">
        <DialogHeader><DialogTitle>Изменить контакт</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-0.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] px-2.5 py-1.5">
            <span className="text-[length:var(--text-xs)] font-medium text-[var(--text-strong)]">{clientName}</span>
            {prototypeNotesEnabled ? <span className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{contact.id}</span> : null}
          </div>
          <label className="col-span-2 flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Имя<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Петрова Анна" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Email<Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anna@example.ru" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Телефон<Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7…" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Telegram<Input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Должность<Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Директор по ИТ" /></label>
        </div>
        <DialogError text={formError} />
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
          <Button variant="default" disabled={!name.trim() || busy} onClick={() => void submit()}><Pencil className="size-3.5" aria-hidden />Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateContactDialog({ data, busy, setBusy, create }: { data: NonNullable<ReturnType<typeof useCrm>["data"]>; busy: boolean; setBusy: (v: boolean) => void; create: ReturnType<typeof useCrm>["createContact"] }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const clients = data.clients.filter((c) => c.status === "active");
  const valid = clientId && name.trim();
  const submit = async () => {
    if (!valid) return;
    setBusy(true); setFormError(null);
    const res = await create({ clientId, name: name.trim(), email: email.trim() || null, phone: phone.trim() || null, role: role.trim() || null });
    setBusy(false);
    if (res.ok) { toast.success("Контакт создан"); setOpen(false); setClientId(""); setName(""); setEmail(""); setPhone(""); setRole(""); }
    // Ошибка остаётся В модалке — раньше уходила строкой внизу страницы.
    else setFormError(crmErr(res.code, res.message));
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setFormError(null); }}>
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
        <DialogError text={formError} />
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
          <Button variant="default" disabled={!valid || busy} onClick={() => void submit()}><Plus className="size-3.5" aria-hidden />Создать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
