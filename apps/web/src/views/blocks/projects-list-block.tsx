"use client";

import * as React from "react";
import { useState } from "react";
import { Filter, Folder, MoreHorizontal, Plus } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CellStack } from "@/components/domain/cell-stack";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { SearchPill } from "@/components/ui/search-pill";
import { Segmented } from "@/components/ui/segmented";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { MOCK_PROJECT_CRM } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";

type ProjectRow = {
  name: string;
  code: string;
  client: string;
  manager: string;
  initials: string;
  status: string;
  due: string;
  archived?: boolean;
};

// Semantic enum→badge mapping (Principle 1): neutral by default, color only when the value carries meaning.
const STATUS_TONE: Record<string, React.ComponentProps<typeof Badge>["variant"]> = {
  "В работе": "secondary",
  "На ревью": "info",
  Завершён: "success",
  Просрочено: "danger"
};

const PROJECTS: ProjectRow[] = [
  {
    name: MOCK_PROJECT_CRM,
    code: "PRJ-2026-014",
    client: "ООО «Ромашка»",
    manager: "Иванова М.",
    initials: "ИМ",
    status: "В работе",
    due: "27.05.2026"
  },
  {
    name: "DataHub KPI — интеграционная витрина показателей",
    code: "PRJ-2026-009",
    client: "АО «Техно»",
    manager: "Петров А.",
    initials: "ПА",
    status: "На ревью",
    due: "12.06.2026"
  },
  {
    name: "Архивный портал",
    code: "PRJ-2025-188",
    client: "ПАО «Энерго»",
    manager: "Сидорова К.",
    initials: "СК",
    status: "Завершён",
    due: "30.12.2025",
    archived: true
  }
];

export function ProjectsListBlock() {
  const [filter, setFilter] = useState<"active" | "archive" | "templates">("active");

  return (
    <>
      <PageIntro
        title="Проекты"
        lead="14 активных проектов, 3 на ревью, 2 на финальной стадии."
        actions={
          <Button variant="primary">
            <Plus className="size-4" aria-hidden />
            Проект
          </Button>
        }
      />
      <div className="view-toolbar">
        <Segmented
          name="projects-filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "active", label: "Активные" },
            { value: "archive", label: "Архив" },
            { value: "templates", label: "Шаблоны" }
          ]}
        />
        <div className="view-toolbar__filters">
          <SearchPill placeholder="Код или название" className="u-w-240" />
          <Button variant="secondary" size="sm" disabled title="Демо Storybook: фильтр подключится к API">
            <Filter className="size-4" aria-hidden />
            Фильтр
          </Button>
        </div>
      </div>
      {filter !== "active" ? (
        <p className="u-text-sm u-text-muted u-mb-3">
          {filter === "archive" ? "Архив проектов (демо переключения)." : "Шаблоны проектов (демо переключения)."}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Клиент</TableHead>
              <TableHead>Ответственный</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead numeric>Срок</TableHead>
              <TableHead>
                <span className="sr-only">Действия</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PROJECTS.map((p) => (
              <TableRow key={p.code} className={cn("group", p.archived && "opacity-60")}>
                <TableCell className="max-w-[18rem]">
                  <CellStack
                    title={p.name}
                    subtitle={p.code}
                    truncate
                    icon={<Folder className="size-4" aria-hidden />}
                  />
                </TableCell>
                <TableCell truncate className="text-[var(--muted)]">
                  {p.client}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarFallback>{p.initials}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{p.manager}</span>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_TONE[p.status] ?? "secondary"}>{p.status}</Badge>
                </TableCell>
                <TableCell numeric className="text-[var(--muted)]">
                  {p.due}
                </TableCell>
                <TableCell align="right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Действия проекта"
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Открыть</DropdownMenuItem>
                      <DropdownMenuItem>Дублировать</DropdownMenuItem>
                      <DropdownMenuItem>В архив</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive">Удалить</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
