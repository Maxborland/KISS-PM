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
import { demoAction } from "@/views/lib/demo";
import { PageIntro } from "@/views/layout/page-intro";

export function ProjectsListBlock() {
  const [filter, setFilter] = useState<"active" | "archive" | "templates">("active");

  return (
    <>
      <PageIntro
        title="Проекты"
        lead="Активные проекты рабочей области."
        actions={
          <Button variant="primary" {...demoAction("создание проекта")}>
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
          <SearchPill
            placeholder="Код или название"
            className="u-w-240"
            disabled
            title="Демо-прототип: поиск подключится к рабочему приложению"
          />
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
          <tr>
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
              <Button variant="ghost" size="icon-sm" aria-label="Действия" {...demoAction("действия проекта")}>
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
              <Button variant="ghost" size="icon-sm" aria-label="Действия" {...demoAction("действия проекта")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </td>
          </tr>
          <tr>
            <td>
              <CellStack
                title="Портал поддержки"
                subtitle="PRJ-2026-021"
                icon={<Folder className="size-4" aria-hidden />}
              />
            </td>
            <td>ООО «Вектор»</td>
            <td>
              <BemAvatar initials="ЕС" color="c3" /> Смирнова Е.
            </td>
            <td>
              <Chip variant="info">На ревью</Chip>
            </td>
            <td className="mono cell-muted">03.07.2026</td>
            <td className="cell-actions">
              <Button variant="ghost" size="icon-sm" aria-label="Действия" {...demoAction("действия проекта")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </td>
          </tr>
          <tr>
            <td>
              <CellStack
                title="Биллинг 2.0"
                subtitle="PRJ-2026-026"
                icon={<Folder className="size-4" aria-hidden />}
              />
            </td>
            <td>АО «Энергия»</td>
            <td>
              <BemAvatar initials="ДК" color="c4" /> Козлов Д.
            </td>
            <td>
              <Chip variant="info">В работе</Chip>
            </td>
            <td className="mono cell-muted">19.07.2026</td>
            <td className="cell-actions">
              <Button variant="ghost" size="icon-sm" aria-label="Действия" {...demoAction("действия проекта")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </td>
          </tr>
          <tr>
            <td>
              <CellStack
                title="Аналитика продаж"
                subtitle="PRJ-2026-031"
                icon={<Folder className="size-4" aria-hidden />}
              />
            </td>
            <td>ООО «Гранит»</td>
            <td>
              <BemAvatar initials="ОМ" color="c5" /> Морозова О.
            </td>
            <td>
              <Chip variant="info">На ревью</Chip>
            </td>
            <td className="mono cell-muted">08.08.2026</td>
            <td className="cell-actions">
              <Button variant="ghost" size="icon-sm" aria-label="Действия" {...demoAction("действия проекта")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </DataTable>
    </>
  );
}
