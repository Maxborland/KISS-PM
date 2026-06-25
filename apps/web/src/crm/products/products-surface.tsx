"use client";

import { useState } from "react";
import { Archive, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SurfaceState } from "@/components/domain/surface-state";
import { CrmFrame } from "@/crm/ui/crm-frame";
import { StatusChip, crmErr, rub } from "@/crm/ui/crm-bits";
import { useCrm } from "@/crm/lib/use-crm";
import type { Product } from "@/crm/lib/crm-client";

const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)]";
const TYPE_LABEL = { service: "Услуга", goods: "Товар" } as const;

export function ProjectProducts() {
  const { data, status, error, reload, createProduct, updateProduct } = useCrm();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
    setBusy(true); setNotice(null);
    const res = await updateProduct(p.id, { name: p.name, type: p.type, unit: p.unit, price: p.price, sku: p.sku, description: p.description, status: to });
    setBusy(false);
    if (res.ok) setNotice(to === "archived" ? "Продукт в архиве" : "Продукт восстановлен");
    else setNotice(`Отклонено: ${crmErr(res.code, res.message)}`);
  };

  return (
    <CrmFrame activeTab="Продукты" subtitle="Справочник продуктов" actions={<CreateProductDialog busy={busy} setBusy={setBusy} setNotice={setNotice} create={createProduct} />}>
      <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
        <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
        Реальный контракт CRM: GET/POST/PATCH /api/workspace/products. Цена — положительное целое (₽). Данные in-memory.
      </div>

      <SurfaceState
        status={surfaceStatus}
        error={error}
        onRetry={() => void reload()}
        errorFormat={crmErr}
        loadingLabel="Загрузка продуктов…"
        empty={{
          title: "Нет продуктов",
          description: "Справочник продуктов пуст — создайте первый продукт.",
          action: <CreateProductDialog busy={busy} setBusy={setBusy} setNotice={setNotice} create={createProduct} />
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
                  <td className="px-3 py-2"><div className="font-medium text-[var(--text-strong)]">{p.name}</div><div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{p.id}</div></td>
                  <td className="px-3 py-2 v4-mono text-[var(--muted)]">{p.sku ?? "—"}</td>
                  <td className="px-3 py-2"><Chip variant={p.type === "service" ? "info" : "violet"}>{TYPE_LABEL[p.type]}</Chip></td>
                  <td className="px-3 py-2 text-[var(--muted-strong)]">{p.unit}</td>
                  <td className="px-3 py-2 text-right v4-num font-semibold text-[var(--text-strong)]">{rub(p.price)}</td>
                  <td className="px-3 py-2"><StatusChip status={p.status} /></td>
                  <td className="px-3 py-2 text-right">
                    {p.status === "active"
                      ? <Button variant="ghost" size="sm" disabled={busy} onClick={() => void toggleArchive(p, "archived")} title="В архив"><Archive className="size-3.5" aria-hidden /></Button>
                      : <Button variant="ghost" size="sm" disabled={busy} onClick={() => void toggleArchive(p, "active")} title="Восстановить"><RotateCcw className="size-3.5" aria-hidden /></Button>}
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

function CreateProductDialog({ busy, setBusy, setNotice, create }: { busy: boolean; setBusy: (v: boolean) => void; setNotice: (v: string | null) => void; create: ReturnType<typeof useCrm>["createProduct"] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"service" | "goods">("service");
  const [unit, setUnit] = useState("проект");
  const [price, setPrice] = useState("100000");
  const [sku, setSku] = useState("");
  const valid = name.trim() && unit.trim() && Number(price) > 0 && Number.isFinite(Number(price));
  const submit = async () => {
    if (!valid) return;
    setBusy(true); setNotice(null);
    const res = await create({ name: name.trim(), type, unit: unit.trim(), price: Math.round(Number(price)), sku: sku.trim() || null });
    setBusy(false);
    if (res.ok) { setNotice("Продукт создан"); setOpen(false); setName(""); setSku(""); }
    else setNotice(`Отклонено: ${crmErr(res.code, res.message)}`);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="default" size="sm"><Plus className="size-3.5" aria-hidden />Продукт</Button></DialogTrigger>
      <DialogContent className="max-w-[500px]">
        <DialogHeader><DialogTitle>Новый продукт</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Название<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Внедрение портала" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Тип
            <select value={type} onChange={(e) => setType(e.target.value as "service" | "goods")} className={selCls}><option value="service">Услуга</option><option value="goods">Товар</option></select>
          </label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Единица<Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="проект / месяц / шт" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Цена, ₽<Input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className="text-right" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">SKU<Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="необязательно" /></label>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
          <Button variant="default" disabled={!valid || busy} onClick={() => void submit()}><Plus className="size-3.5" aria-hidden />Создать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
