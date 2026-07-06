"use client";

import { useState } from "react";
import { Archive, Pencil, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormDialog } from "@/components/domain/form-dialog";
import { Input } from "@/components/ui/input";
import { SurfaceState } from "@/components/domain/surface-state";
import { CrmFrame } from "@/crm/ui/crm-frame";
import { StatusChip, crmErr, rub } from "@/crm/ui/crm-bits";
import { useCrm } from "@/crm/lib/use-crm";
import type { Product } from "@/crm/lib/crm-client";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)]";
const TYPE_LABEL = { service: "Услуга", goods: "Товар" } as const;

export function ProjectProducts() {
  const { data, status, error, reload, createProduct, updateProduct } = useCrm();
  const [busy, setBusy] = useState(false);

  // Верхнеуровневый статус поверхности: forbidden/error/loading из хука; пустой справочник → empty; иначе ready.
  const surfaceStatus =
    status === "forbidden"
      ? "forbidden"
      : status === "error"
        ? "error"
        : !data
          ? "loading"
          : data.products.length === 0
            ? "empty"
            : "ready";

  // архив/восстановление шлёт ПОЛНУЮ запись (боевой PATCH — full-replace, требует name/unit/price)
  const toggleArchive = async (p: Product, to: "active" | "archived") => {
    setBusy(true);
    const res = await updateProduct(p.id, { name: p.name, type: p.type, unit: p.unit, price: p.price, sku: p.sku, description: p.description, status: to });
    setBusy(false);
    if (res.ok) toast.success(to === "archived" ? "Продукт в архиве" : "Продукт восстановлен");
    else toast.error(`Отклонено: ${crmErr(res.code, res.message)}`);
  };

  return (
    <CrmFrame activeTab="Продукты" subtitle="Справочник продуктов" actions={<CreateProductDialog busy={busy} setBusy={setBusy} create={createProduct} />}>
      {prototypeNotesEnabled && (
        <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          Реальный контракт CRM: GET/POST/PATCH /api/workspace/products. Цена — положительное целое (₽). Данные in-memory.
        </div>
      )}

      <SurfaceState
        status={surfaceStatus}
        error={error}
        onRetry={() => void reload()}
        errorFormat={crmErr}
        loadingLabel="Загрузка продуктов…"
        empty={{
          title: "Нет продуктов",
          description: "Справочник продуктов пуст — создайте первый продукт.",
          action: <CreateProductDialog busy={busy} setBusy={setBusy} create={createProduct} />
        }}
        forbidden={{ title: "Доступ к продуктам ограничен", description: "У вас нет прав на просмотр справочника продуктов." }}
      >
        <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <thead><tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
              <th className="px-3 py-2 font-semibold">Продукт</th><th className="px-3 py-2 font-semibold">SKU</th><th className="px-3 py-2 font-semibold">Тип</th><th className="px-3 py-2 font-semibold">Ед.</th><th className="px-3 py-2 text-right font-semibold">Цена</th><th className="px-3 py-2 font-semibold">Статус</th><th className="px-3 py-2" />
            </tr></thead>
            <tbody>
              {(data?.products ?? []).map((p) => (
                <tr key={p.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-3 py-2"><div className="font-medium text-[var(--text-strong)]">{p.name}</div>{prototypeNotesEnabled ? <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{p.id}</div> : null}</td>
                  <td className="px-3 py-2 v4-mono text-[var(--muted)]">{p.sku ?? "—"}</td>
                  <td className="px-3 py-2"><Chip variant={p.type === "service" ? "info" : "violet"}>{TYPE_LABEL[p.type]}</Chip></td>
                  <td className="px-3 py-2 text-[var(--muted-strong)]">{p.unit}</td>
                  <td className="px-3 py-2 text-right v4-num font-semibold text-[var(--text-strong)]">{rub(p.price)}</td>
                  <td className="px-3 py-2"><StatusChip status={p.status} /></td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <EditProductDialog product={p} busy={busy} setBusy={setBusy} update={updateProduct} />
                      {p.status === "active"
                        ? (
                          // Архивирование — только через подтверждение (G4-19).
                          <ConfirmDialog
                            title={`Архивировать «${p.name}»?`}
                            description="Запись будет перенесена в архив."
                            confirmLabel="В архив"
                            onConfirm={() => toggleArchive(p, "archived")}
                          >
                            <Button variant="ghost" size="sm" disabled={busy} title="В архив"><Archive className="size-3.5" aria-hidden /></Button>
                          </ConfirmDialog>
                        )
                        : <Button variant="ghost" size="sm" disabled={busy} onClick={() => void toggleArchive(p, "active")} title="Восстановить"><RotateCcw className="size-3.5" aria-hidden /></Button>}
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

// Редактирование продукта (G4-07): управляемый диалог по образцу EditUserDialog; тип НЕ меняется (показан справочно).
function EditProductDialog({ product, busy, setBusy, update }: { product: Product; busy: boolean; setBusy: (v: boolean) => void; update: ReturnType<typeof useCrm>["updateProduct"] }) {
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku ?? "");
  const [unit, setUnit] = useState(product.unit);
  const [price, setPrice] = useState(String(product.price));
  const [description, setDescription] = useState(product.description ?? "");
  // валидация как в диалоге создания: цена — положительное целое (₽)
  const valid = name.trim() && unit.trim() && Number(price) > 0 && Number.isFinite(Number(price));
  return (
    <FormDialog
      title="Изменить продукт"
      trigger={<Button variant="ghost" size="sm" disabled={busy} title="Изменить"><Pencil className="size-3.5" aria-hidden /></Button>}
      // при открытии диалога синхронизируем форму с текущей записью
      onOpenChange={(v) => { if (v) { setName(product.name); setSku(product.sku ?? ""); setUnit(product.unit); setPrice(String(product.price)); setDescription(product.description ?? ""); } }}
      submitLabel={<><Pencil className="size-3.5" aria-hidden />Сохранить</>}
      submitDisabled={!valid || busy}
      successToast={`Продукт «${name.trim()}» обновлён`}
      contentClassName="max-w-[500px]"
      // Ошибка остаётся В модалке — по месту действия.
      onSubmit={async () => {
        if (!valid) return null;
        setBusy(true);
        // PATCH — полная запись (боевой full-replace); тип и статус не меняем — сохраняем текущие.
        const res = await update(product.id, { name: name.trim(), type: product.type, unit: unit.trim(), price: Math.round(Number(price)), sku: sku.trim() || null, description: description.trim() || null, status: product.status });
        setBusy(false);
        return res.ok ? null : crmErr(res.code, res.message);
      }}
    >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-0.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] px-2.5 py-1.5">
            <span className="text-[length:var(--text-xs)] font-medium text-[var(--text-strong)]">{TYPE_LABEL[product.type]}</span>
            {prototypeNotesEnabled ? <span className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{product.id}</span> : null}
          </div>
          <label className="col-span-2 flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Название<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Внедрение портала" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Единица<Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="проект / месяц / шт" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Цена, ₽<Input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className="text-right" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">SKU<Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="необязательно" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Описание<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="необязательно" /></label>
        </div>
    </FormDialog>
  );
}

function CreateProductDialog({ busy, setBusy, create }: { busy: boolean; setBusy: (v: boolean) => void; create: ReturnType<typeof useCrm>["createProduct"] }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"service" | "goods">("service");
  const [unit, setUnit] = useState("проект");
  const [price, setPrice] = useState("100000");
  const [sku, setSku] = useState("");
  const valid = name.trim() && unit.trim() && Number(price) > 0 && Number.isFinite(Number(price));
  return (
    <FormDialog
      title="Новый продукт"
      trigger={<Button variant="default" size="sm"><Plus className="size-3.5" aria-hidden />Продукт</Button>}
      submitLabel={<><Plus className="size-3.5" aria-hidden />Создать</>}
      submitDisabled={!valid || busy}
      successToast="Продукт создан"
      contentClassName="max-w-[500px]"
      // Ошибка остаётся В модалке — раньше уходила строкой внизу страницы.
      onSubmit={async () => {
        if (!valid) return null;
        setBusy(true);
        const res = await create({ name: name.trim(), type, unit: unit.trim(), price: Math.round(Number(price)), sku: sku.trim() || null });
        setBusy(false);
        return res.ok ? null : crmErr(res.code, res.message);
      }}
      onSuccess={() => { setName(""); setSku(""); }}
    >
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Название<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Внедрение портала" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Тип
            <select value={type} onChange={(e) => setType(e.target.value as "service" | "goods")} className={selCls}><option value="service">Услуга</option><option value="goods">Товар</option></select>
          </label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Единица<Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="проект / месяц / шт" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Цена, ₽<Input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className="text-right" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">SKU<Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="необязательно" /></label>
        </div>
    </FormDialog>
  );
}
