"use client";

import { useMemo, useState } from "react";
import { Filter, Folder, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Chip } from "@/components/ui/chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SearchPill } from "@/components/ui/search-pill";
import { Segmented } from "@/components/ui/segmented";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import type { Project, ProjectTemplate } from "@/lib/api-types";
import { formatDate, formatDateRange, formatHours, formatRub } from "@/lib/mock-data/format";
import { useScenarioFixtures } from "@/lib/mock-data/scenario-context";
import { ScreenBlockGate, ScreenBlockPanelSkeleton } from "@/views/blocks/screen-block-fetch";
import { projectTemplateName } from "@/lib/mock-data/workspace-config";
import { positionName, userAvatar } from "@/lib/mock-data/users";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

export type ProjectsListBlockProps = {
  projects?: Project[];
  projectTemplates?: ProjectTemplate[];
  getProjectHref?: (project: Project) => string;
  readOnly?: boolean;
};

type ProjectRow = Project & {
  code: string;
  owner: { initials: string; color: "c1" | "c2" | "c3" | "c4" | "c5"; name: string };
  statusVariant: "info" | "success" | "warning";
};

function formatProjectSourceType(sourceType: Project["sourceType"]): string {
  switch (sourceType) {
    case "opportunity":
      return "Из сделки CRM";
    case "workspace_inbox":
      return "Из входящих рабочей области";
    case "manual":
      return "Создан вручную";
    default:
      return sourceType;
  }
}

function projectStatusLabel(status: Project["status"]): string {
  if (status === "active") return "Активен";
  if (status === "closed") return "Закрыт";
  if (status === "draft") return "Черновик";
  return status;
}

function buildProjectRows(projects: Project[]): ProjectRow[] {
  return projects.map((project, index) => ({
  ...project,
  code: project.id,
  owner: { ...userAvatar(index === 1 ? "usr-petrov" : "usr-ivanova"), name: index === 1 ? "Петров А." : "Иванова М." },
  statusVariant: project.status === "closed" ? "success" : "info"
}));
}

function buildTemplateProjects(templates: ProjectTemplate[]): ProjectRow[] {
  return templates.map((template, index) => ({
  id: template.id,
  tenantId: template.tenantId,
  sourceType: "manual",
  sourceOpportunityId: null,
  clientId: null,
  projectTypeId: null,
  title: template.tenantLabel,
  clientName: "—",
  status: template.status,
  plannedStart: template.createdAt,
  plannedFinish: template.updatedAt,
  contractValue: 0,
  plannedHours: 0,
  templateId: template.id,
  createdAt: template.createdAt,
  activatedAt: null,
  demand: [],
  code: template.systemKey,
  owner: { ...userAvatar(index === 0 ? "usr-kozlova" : "usr-petrov"), name: index === 0 ? "Козлова Е." : "Петров А." },
  statusVariant: "warning"
}));
}

function matchesQuery(row: ProjectRow, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    row.title.toLowerCase().includes(q) ||
    row.code.toLowerCase().includes(q) ||
    row.clientName.toLowerCase().includes(q)
  );
}

function projectsForFilter(
  filter: "active" | "archive" | "templates",
  active: ProjectRow[],
  archived: ProjectRow[],
  templates: ProjectRow[]
): ProjectRow[] {
  if (filter === "archive") return archived;
  if (filter === "templates") return templates;
  return active;
}

export function resolveProjectsListSources(
  fixtures: { projects: Project[]; projectTemplates: ProjectTemplate[] },
  props: {
    projects?: Project[] | undefined;
    projectTemplates?: ProjectTemplate[] | undefined;
  } = {}
) {
  return {
    projects: props.projects ?? fixtures.projects,
    projectTemplates: props.projectTemplates ?? fixtures.projectTemplates
  };
}

export function ProjectsListBlock({
  projects,
  projectTemplates,
  getProjectHref,
  readOnly = false
}: ProjectsListBlockProps = {}) {
  const { fixtures } = useScenarioFixtures();
  const sources = useMemo(
    () => resolveProjectsListSources(fixtures, { projects, projectTemplates }),
    [fixtures, projects, projectTemplates]
  );
  const projectRows = useMemo(() => buildProjectRows(sources.projects), [sources.projects]);
  const activeProjects = useMemo(
    () => projectRows.filter((project) => project.status === "active"),
    [projectRows]
  );
  const archivedProjects = useMemo(
    () => projectRows.filter((project) => project.status === "closed"),
    [projectRows]
  );
  const templateProjects = useMemo(
    () => buildTemplateProjects(sources.projectTemplates),
    [sources.projectTemplates]
  );

  const [filter, setFilter] = useState<"active" | "archive" | "templates">("active");
  const [query, setQuery] = useState("");
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");

  const source = projectsForFilter(filter, activeProjects, archivedProjects, templateProjects);
  const filtered = useMemo(() => source.filter((r) => matchesQuery(r, query)), [source, query]);
  const openProject = useMemo(
    () => source.find((r) => r.id === openProjectId) ?? null,
    [source, openProjectId]
  );

  const handleCreate = () => {
    if (!createTitle.trim()) return;
    toast.success(`Проект «${createTitle.trim()}» создан (демо)`);
    setCreateTitle("");
    setCreateOpen(false);
  };

  const openProjectRow = (row: ProjectRow) => {
    const href = getProjectHref?.(row);
    if (href) {
      window.location.assign(href);
      return;
    }
    setOpenProjectId(row.id);
  };

  const intro = (
    <RoutePageIntro
      actions={
        <Button
          variant="primary"
          onClick={() => setCreateOpen(true)}
          disabled={readOnly}
          title={readOnly ? "Создание проекта будет подключено в следующем API-срезе" : undefined}
        >
          <Plus className="size-4" aria-hidden />
          Проект
        </Button>
      }
    />
  );

  return (
    <ScreenBlockGate
      intro={intro}
      skeleton={<ScreenBlockPanelSkeleton rows={6} />}
      errorTitle="Не удалось загрузить проекты"
      forbiddenTitle="Нет доступа к проектам"
    >
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
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <Button variant="secondary" size="sm" disabled title="Демо Storybook: фильтр подключится к API">
            <Filter className="size-4" aria-hidden />
            Фильтр
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={filter === "active" ? "Нет проектов по запросу" : filter === "archive" ? "Архив пуст" : "Нет шаблонов"}
          description={
            filter === "active"
              ? "Измените поиск или создайте новый проект."
              : filter === "archive"
                ? "Закрытые проекты появятся здесь после архивации."
                : "Сохраните проект как шаблон, чтобы переиспользовать структуру."
          }
          action={
            filter === "active" ? (
              <Button
                variant="primary"
                onClick={() => setCreateOpen(true)}
                disabled={readOnly}
                title={readOnly ? "Создание проекта будет подключено в следующем API-срезе" : undefined}
              >
                Создать проект
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable>
          <thead>
            <tr>
              <th>Название</th>
              <th>Клиент</th>
              <th>Ответственный</th>
              <th>Статус</th>
              <th>План / экономика</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, index) => (
              <tr
                key={row.id}
                tabIndex={0}
                aria-label={`Открыть ${row.title}`}
                className={cn(
                  "row-clickable",
                  index === 0 && filter === "active" && !query && "is-selected"
                )}
                onClick={() => openProjectRow(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openProjectRow(row);
                  }
                }}
              >
                <td>
                  <CellStack
                    title={row.title}
                    subtitle={row.code}
                    icon={<Folder className="size-4" aria-hidden />}
                  />
                </td>
                <td>{row.clientName}</td>
                <td>
                  <BemAvatar initials={row.owner.initials} color={row.owner.color} /> {row.owner.name}
                </td>
                <td>
                  <Chip variant={row.statusVariant}>{projectStatusLabel(row.status)}</Chip>
                  <div className="u-text-xs u-text-muted">
                    {filter === "templates" ? "Из шаблона" : formatProjectSourceType(row.sourceType)}
                  </div>
                </td>
                <td>
                  <CellStack
                    title={formatDateRange(row.plannedStart, row.plannedFinish)}
                    subtitle={`${formatRub(row.contractValue)} · ${formatHours(row.plannedHours)}`}
                  />
                </td>
                <td className="cell-actions" onClick={(event) => event.stopPropagation()}>
                  <ProjectRowMenu project={row} readOnly={readOnly} />
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      <Sheet open={openProject != null} onOpenChange={(open) => !open && setOpenProjectId(null)}>
        <SheetContent size="lg">
          {openProject ? (
            <>
              <SheetHeader>
                <SheetTitle>{openProject.title}</SheetTitle>
                <SheetDescription>
                  {openProject.code} · {openProject.clientName}
                </SheetDescription>
              </SheetHeader>
              <SheetBody>
                <div className="u-flex u-flex-col u-gap-3">
                  <CellStack title="Ответственный" subtitle={openProject.owner.name} />
                  <CellStack
                    title="Источник"
                    subtitle={`${filter === "templates" ? "Из шаблона" : formatProjectSourceType(openProject.sourceType)} · ${openProject.sourceOpportunityId ?? "без сделки"}`}
                  />
                  <CellStack title="Период" subtitle={formatDateRange(openProject.plannedStart, openProject.plannedFinish)} />
                  <CellStack title="Экономика" subtitle={`${formatRub(openProject.contractValue)} · ${formatHours(openProject.plannedHours)}`} />
                  <CellStack title="Шаблон" subtitle={projectTemplateName(openProject.templateId)} />
                  <CellStack title="Создан / активирован" subtitle={`${formatDate(openProject.createdAt)} · ${formatDate(openProject.activatedAt)}`} />
                  <div className="u-flex u-flex-col u-gap-2">
                    <span className="u-text-xs u-text-muted">Потребность по должностям</span>
                    {openProject.demand.length === 0 ? (
                      <span className="u-text-sm u-text-muted">Для шаблона потребность не задана.</span>
                    ) : (
                      openProject.demand.map((item) => (
                        <div key={item.positionId} className="u-flex u-items-center u-justify-between u-text-sm">
                          <span>{positionName(item.positionId)}</span>
                          <span className="mono">{formatHours(item.requiredHours)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </SheetBody>
              <SheetFooter>
                <Button variant="secondary" onClick={() => setOpenProjectId(null)}>
                  Закрыть
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Новый проект</SheetTitle>
            <SheetDescription>Демо Storybook: черновик без сохранения в API.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <label className="field">
              <span className="field__label field__label--required">Название</span>
              <Input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Например, Внедрение CRM"
              />
            </label>
          </SheetBody>
          <SheetFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button variant="primary" disabled={!createTitle.trim()} onClick={handleCreate}>
              Создать
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ScreenBlockGate>
  );
}

function ProjectRowMenu({ project, readOnly }: { project: ProjectRow; readOnly: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Действия: ${project.title}`}
          disabled={readOnly}
          title={readOnly ? "Изменение проектов будет подключено в следующем API-срезе" : undefined}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => toast.info(`Редактировать · ${project.title}`)}>
          Редактировать
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast.info(`Архивировать · ${project.title}`)}>
          Архивировать
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-[var(--danger)]"
          onClick={() => toast.error(`Удалить · ${project.title}`)}
        >
          Удалить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
