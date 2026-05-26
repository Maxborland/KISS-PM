"use client";

import { useMemo, useState } from "react";
import { Filter, MoreHorizontal, Plus, Upload } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { SearchPill } from "@/components/ui/search-pill";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { formatDate, formatRub } from "@/lib/mock-data/format";
import { buildEntityCopy } from "@/lib/mock-data/scenario-presenters";
import { useScenarioFixtures } from "@/lib/mock-data/scenario-context";
import { PageIntro } from "@/views/layout/page-intro";
import { ScreenBlockGate, ScreenBlockPanelSkeleton } from "@/views/blocks/screen-block-fetch";

export type EntityKind = "clients" | "contacts" | "products";

type EntityRow = Record<string, unknown> & { name: string; code: string };

function matchesQuery(row: EntityRow, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return row.name.toLowerCase().includes(q) || row.code.toLowerCase().includes(q);
}

export function EntitiesBlock({ kind }: { kind: EntityKind }) {
  const { fixtures } = useScenarioFixtures();
  const c = useMemo(() => buildEntityCopy(kind, fixtures), [kind, fixtures]);
  const [query, setQuery] = useState("");
  const [openName, setOpenName] = useState<string | null>(null);

  const filtered = useMemo(() => c.rows.filter((r) => matchesQuery(r, query)), [c.rows, query]);

  const openRow = useMemo(() => c.rows.find((r) => r.name === openName) ?? null, [c.rows, openName]);

  const intro = (
    <PageIntro
      title={c.title}
      lead={c.lead}
      actions={
        <>
            <Button variant="secondary" disabled title="Демо Storybook: импорт подключится к API">
              <Upload className="size-4" aria-hidden />
              Импорт
            </Button>
            <Button variant="primary" disabled title="Демо Storybook: добавление подключится к API">
              <Plus className="size-4" aria-hidden />
              Добавить
            </Button>
          </>
        }
    />
  );

  return (
    <ScreenBlockGate
      intro={intro}
      skeleton={<ScreenBlockPanelSkeleton rows={5} />}
      errorTitle="Не удалось загрузить справочник"
      forbiddenTitle="Нет доступа к справочнику"
    >
      <div className="view-toolbar">
        <SearchPill
          className="u-w-280"
          placeholder={`Поиск в «${c.title}»`}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <Button variant="secondary" size="sm" disabled title="Демо Storybook: фильтр подключится к API">
          <Filter className="size-4" aria-hidden />
          Фильтр
        </Button>
      </div>
      <DataTable>
        <thead>
          <tr>
            {c.cols.map((col) => (
              <th key={col}>{col}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={c.cols.length + 1} className="u-text-sm u-text-muted">
                Ничего не найдено.
              </td>
            </tr>
          ) : (
            filtered.map((r) => (
              <tr
                key={r.code}
                tabIndex={0}
                aria-label={`Открыть ${r.name}`}
                className="row-clickable"
                onClick={() => setOpenName(r.name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setOpenName(r.name);
                  }
                }}
              >
                <td>
                  <CellStack title={r.name} subtitle={r.code} />
                </td>
                {kind === "clients" ? (
                  <>
                    <td>
                      <Chip variant={String(r.status) === "active" ? "success" : "warning"}>{String(r.status)}</Chip>
                    </td>
                    <td>{String(r.description ?? "—")}</td>
                    <td className="mono">{formatDate(String(r.createdAt))}</td>
                    <td className="mono">{formatDate(String(r.updatedAt))}</td>
                  </>
                ) : null}
                {kind === "contacts" ? (
                  <>
                    <td>{String(r.company)}</td>
                    <td>{String(r.role)}</td>
                    <td className="u-text-muted">
                      <CellStack title={String(r.email ?? "—")} subtitle={`${String(r.phone ?? "—")} · ${String(r.telegram ?? "—")}`} />
                    </td>
                    <td>
                      <Chip variant={String(r.status) === "active" ? "success" : "warning"}>{String(r.status)}</Chip>
                    </td>
                  </>
                ) : null}
                {kind === "products" ? (
                  <>
                    <td>
                      <CellStack title={String(r.sku ?? "—")} subtitle={String(r.type)} />
                    </td>
                    <td>{String(r.unit)}</td>
                    <td className="mono">{formatRub(Number(r.price))}</td>
                    <td>
                      {String(r.status) === "active" ? (
                        <Chip variant="success">Активен</Chip>
                      ) : (
                        <Chip>Черновик</Chip>
                      )}
                    </td>
                  </>
                ) : null}
                <td className="cell-actions" onClick={(event) => event.stopPropagation()}>
                  <EntityRowMenu name={r.name} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>

      <Sheet open={openRow != null} onOpenChange={(open) => !open && setOpenName(null)}>
        <SheetContent>
          {openRow ? (
            <>
              <SheetHeader>
                <SheetTitle>{openRow.name}</SheetTitle>
                <SheetDescription>
                  {openRow.code} · {c.title}
                </SheetDescription>
              </SheetHeader>
              <SheetBody>
                <EntityContractDetails kind={kind} row={openRow} />
              </SheetBody>
              <SheetFooter>
                <Button variant="secondary" onClick={() => setOpenName(null)}>
                  Закрыть
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </ScreenBlockGate>
  );
}

function EntityContractDetails({ kind, row }: { kind: EntityKind; row: EntityRow }) {
  const rows =
    kind === "clients"
      ? [
          ["id", String(row.id)],
          ["tenantId", String(row.tenantId)],
          ["description", String(row.description ?? "—")],
          ["status", String(row.status)],
          ["createdAt", formatDate(String(row.createdAt))],
          ["updatedAt", formatDate(String(row.updatedAt))]
        ]
      : kind === "contacts"
        ? [
            ["id", String(row.id)],
            ["tenantId", String(row.tenantId)],
            ["clientId", String(row.clientId)],
            ["clientName", String(row.company)],
            ["email", String(row.email ?? "—")],
            ["phone", String(row.phone ?? "—")],
            ["telegram", String(row.telegram ?? "—")],
            ["role", String(row.role ?? "—")],
            ["status", String(row.status)]
          ]
        : [
            ["id", String(row.id)],
            ["tenantId", String(row.tenantId)],
            ["sku", String(row.sku ?? "—")],
            ["type", String(row.type)],
            ["unit", String(row.unit)],
            ["price", formatRub(Number(row.price))],
            ["description", String(row.description ?? "—")],
            ["status", String(row.status)]
          ];

  return (
    <dl className="entity-fields">
      {rows.map(([label, value]) => (
        <div key={label} className="entity-fields__row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function EntityRowMenu({ name }: { name: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Действия: ${name}`}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled>Открыть карточку</DropdownMenuItem>
        <DropdownMenuItem disabled>Скопировать ссылку</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Архивировать</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
