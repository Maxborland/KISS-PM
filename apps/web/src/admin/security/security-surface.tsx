"use client";

import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { useEffect, useMemo, useState } from "react";
import { Plus, Save, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceState } from "@/components/domain/surface-state";
import { AdminFrame } from "@/admin/ui/admin-frame";
import { adminErr } from "@/admin/ui/admin-bits";
import { useSecurityPolicy } from "@/admin/lib/use-security-policy";
import type { SecurityPolicy } from "@/admin/lib/admin-client";

const labelCls = "text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]";
const hintCls = "text-[length:var(--text-xs)] text-[var(--muted)]";

const normalizeList = (list: string[]): string[] =>
  Array.from(new Set(list.map((e) => e.trim().toLowerCase()).filter((e) => e.length > 0)));

const sameList = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export function AdminSecuritySurface() {
  const { policy, status, error, reload, save } = useSecurityPolicy();
  const [form, setForm] = useState<SecurityPolicy | null>(null);
  const [domainDraft, setDomainDraft] = useState("");
  const [busy, setBusy] = useState(false);

  // Синхронизируем локальную форму при загрузке/перезагрузке политики.
  useEffect(() => {
    if (policy) setForm(policy);
  }, [policy]);

  const surfaceStatus = status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : status === "error" ? "error" : !form ? "loading" : "ready";

  // 2FA/SSO — reserved-поля контракта (Н5): контролов в UI нет, значения не меняются,
  // поэтому в dirty участвуют только реально редактируемые поля.
  const dirty = useMemo(() => {
    if (!policy || !form) return false;
    return (
      policy.sessionTimeoutHours !== form.sessionTimeoutHours ||
      !sameList(policy.domainAllowlist, form.domainAllowlist)
    );
  }, [policy, form]);

  const timeoutValid = Boolean(form && Number.isInteger(form.sessionTimeoutHours) && form.sessionTimeoutHours >= 1 && form.sessionTimeoutHours <= 8760);

  const addDomain = () => {
    if (!form) return;
    const next = normalizeList([...form.domainAllowlist, domainDraft]);
    setForm({ ...form, domainAllowlist: next });
    setDomainDraft("");
  };
  const removeDomain = (domain: string) => {
    if (!form) return;
    setForm({ ...form, domainAllowlist: form.domainAllowlist.filter((d) => d !== domain) });
  };

  const submit = async () => {
    if (!form || !timeoutValid) return;
    setBusy(true);
    const res = await save({ ...form, domainAllowlist: normalizeList(form.domainAllowlist) });
    setBusy(false);
    if (res.ok) toast.success("Политика безопасности сохранена");
    else toast.error(`Отклонено: ${adminErr(res.code, res.message)}`);
  };

  return (
    <AdminFrame
      activeTab="Безопасность"
      subtitle="Политики безопасности рабочей области"
      actions={
        <Button variant="default" size="sm" disabled={!dirty || !timeoutValid || busy} onClick={() => void submit()}>
          <Save className="size-3.5" aria-hidden />
          Сохранить
        </Button>
      }
    >
      {prototypeNotesEnabled ? (
        <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          <span>Реальный контракт: GET/PUT /api/tenant/current/security-policy (createAdminClient + in-memory mock, swap = apiOrigin). Изменение требует права управления конфигурацией рабочей области (canManageWorkspaceConfig); каждое сохранение пишется в журнал аудита.</span>
        </div>
      ) : null}

      <SurfaceState status={surfaceStatus} error={error} onRetry={() => void reload()} errorFormat={(c) => adminErr(c)}>
        {form ? (
          <div className="max-w-[640px] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2.5 border-b border-[var(--border)] bg-[var(--panel-subtle)] px-4 py-3">
              <ShieldCheck className="size-4 text-[var(--accent)]" aria-hidden />
              <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-base)] font-bold text-[var(--text-strong)]">Политики безопасности</h2>
            </div>

            <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
              {/* 2FA/SSO — механизмов в auth-стеке нет (Н5, решение зафиксировано: не реализуем сейчас).
                  Вместо вечно-disabled свитчей — честный роадмап-текст БЕЗ псевдо-контролов
                  (no-fake-controls). Поля twoFactorRequired/ssoSamlEnabled остаются в контракте
                  как reserved и передаются при сохранении без изменений. */}
              <div className="flex flex-col gap-0.5 px-4 py-3">
                <span className={labelCls}>Двухфакторная аутентификация и единый вход (SSO)</span>
                <span className={hintCls}>
                  2FA и SSO (SAML) в этой версии не реализованы — настройки появятся здесь после
                  реализации механизма в подсистеме аутентификации.
                </span>
              </div>

              {/* Тайм-аут сессии — применяется при входе (срок жизни новой сессии). */}
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="flex flex-col gap-0.5">
                  <span className={labelCls}>Тайм-аут сессии</span>
                  <span className={hintCls}>Срок жизни сессии в часах (1…8760). Применяется к новым входам.</span>
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={8760}
                    value={String(form.sessionTimeoutHours)}
                    onChange={(e) => setForm({ ...form, sessionTimeoutHours: Math.trunc(Number(e.target.value)) || 0 })}
                    aria-invalid={!timeoutValid}
                    className="w-24 text-right"
                  />
                  <span className={hintCls}>часов</span>
                </div>
              </div>

              {/* Whitelist доменов */}
              <div className="flex flex-col gap-2 px-4 py-3">
                <span className="flex flex-col gap-0.5">
                  <span className={labelCls}>Разрешённые email-домены</span>
                  <span className={hintCls}>Создать пользователя или сменить email можно только на этих доменах. Пусто — ограничения нет.</span>
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    value={domainDraft}
                    onChange={(e) => setDomainDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDomain(); } }}
                    placeholder="company.com"
                    className="max-w-[260px]"
                  />
                  <Button variant="outline" size="sm" disabled={domainDraft.trim().length === 0} onClick={addDomain}>
                    <Plus className="size-3.5" aria-hidden />
                    Добавить
                  </Button>
                </div>
                {form.domainAllowlist.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {form.domainAllowlist.map((domain) => (
                      <span key={domain} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel-subtle)] py-0.5 pl-2.5 pr-1 text-[length:var(--text-xs)] text-[var(--text-strong)]">
                        {domain}
                        <button type="button" onClick={() => removeDomain(domain)} aria-label={`Удалить ${domain}`} className="grid size-4 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--text-strong)]">
                          <X className="size-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className={hintCls}>Список пуст — приглашать можно с любого домена.</span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </SurfaceState>
    </AdminFrame>
  );
}
