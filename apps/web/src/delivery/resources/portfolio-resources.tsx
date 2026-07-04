"use client";

import { useMemo, useState } from "react";

import { buildPortfolioModel } from "@/delivery/lib/mock-planning-backend";
import { RESOURCES } from "@/delivery/lib/planning-demo-data";
import { ReportingFrame } from "@/delivery/ui/reporting-frame";
import { ResourceLoadMatrix, type MatrixData, type MatrixScope } from "@/delivery/resources/resource-load-matrix";

const TEAMS = [...new Map(RESOURCES.map((r) => [r.teamId, r.teamName])).entries()];

/**
 * PortfolioResources — ТОТ ЖЕ ResourceLoadMatrix, но на отчётном уровне
 * (компания / отдельная команда) по нескольким проектам. Переключатель скоупа
 * меняет только данные и groupLevels — компонент не переделывается.
 * Read-only: правки делаются в проекте.
 */
export function PortfolioResources() {
  const portfolio = useMemo(() => buildPortfolioModel(), []);
  const [scopeSel, setScopeSel] = useState<string>("company"); // "company" | teamId

  const { data, scope, subtitle } = useMemo(() => {
    const isCompany = scopeSel === "company";
    const resources = isCompany ? RESOURCES : RESOURCES.filter((r) => r.teamId === scopeSel);
    const d: MatrixData = {
      buckets: portfolio.buckets,
      resources,
      taskById: new Map(portfolio.tasks.map((t) => [t.id, t])),
      asgById: new Map(portfolio.assignments.map((x) => [x.id, x])),
      calcStartById: new Map(portfolio.calc.map((c) => [c.id, c.calculatedStart])),
      accepted: new Set<string>(),
      projects: portfolio.projects.map((pr) => ({ id: pr.id, name: pr.name }))
    };
    const s: MatrixScope = isCompany
      ? { level: "company", groupLevels: ["team", "role", "person"], windowNoun: "портфель" }
      : { level: "team", groupLevels: ["role", "person"], windowNoun: "портфель" };
    const teamName = TEAMS.find(([id]) => id === scopeSel)?.[1] ?? "";
    const sub = isCompany
      ? `Портфель · ${portfolio.projects.length} проекта · ${resources.length} человек`
      : `Команда «${teamName}» · ${resources.length} человек · ${portfolio.projects.length} проекта`;
    return { data: d, scope: s, subtitle: sub };
  }, [portfolio, scopeSel]);

  const switcher = (
    <select
      value={scopeSel}
      onChange={(e) => setScopeSel(e.target.value)}
      aria-label="Скоуп"
      className="h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] font-medium text-[var(--text-strong)] outline-none focus:border-[var(--accent)]"
    >
      <option value="company">Вся компания</option>
      {TEAMS.map(([id, name]) => <option key={id} value={id}>Команда: {name}</option>)}
    </select>
  );

  return (
    <ReportingFrame title="Загрузка ресурсов" subtitle={subtitle} controls={switcher}>
      <ResourceLoadMatrix scope={scope} data={data} />
    </ReportingFrame>
  );
}
