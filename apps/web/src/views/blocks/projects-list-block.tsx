"use client";

import { useState } from "react";
import { Filter, Folder, MoreHorizontal, Plus } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Chip } from "@/components/ui/chip";
import { SearchPill } from "@/components/ui/search-pill";
import { Segmented } from "@/components/ui/segmented";
import { MOCK_PROJECT_CRM } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";

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
      <DataTable>
        <thead>
          <tr>
            <th>Название</th>
            <th>Клиент</th>
            <th>Ответственный</th>
            <th>Статус</th>
            <th>Срок</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr className="is-selected">
            <td>
              <CellStack
                title={MOCK_PROJECT_CRM}
                subtitle="PRJ-2026-014"
                icon={<Folder className="size-4" aria-hidden />}
              />
            </td>
            <td>ООО «Ромашка»</td>
            <td>
              <BemAvatar initials="ИИ" color="c1" /> Иванова М.
            </td>
            <td>
              <Chip variant="info">В работе</Chip>
            </td>
            <td className="mono cell-muted">27.05.2026</td>
            <td className="cell-actions">
              <Button variant="ghost" size="icon-sm" aria-label="Действия">
                <MoreHorizontal className="size-4" />
              </Button>
            </td>
          </tr>
          <tr>
            <td>
              <CellStack title="DataHub KPI" subtitle="PRJ-2026-009" icon={<Folder className="size-4" aria-hidden />} />
            </td>
            <td>АО «Техно»</td>
            <td>
              <BemAvatar initials="АП" color="c2" /> Петров А.
            </td>
            <td>
              <Chip variant="info">В работе</Chip>
            </td>
            <td className="mono cell-muted">12.06.2026</td>
            <td className="cell-actions">
              <Button variant="ghost" size="icon-sm" aria-label="Действия">
                <MoreHorizontal className="size-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </DataTable>
    </>
  );
}
