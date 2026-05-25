import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { CardPanel } from "@/components/domain/card-panel";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { MOCK_PLAN_BASELINES } from "@/lib/mock-data/capacity";
import { formatDate } from "@/lib/mock-data/format";
import { mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";

const ROWS = MOCK_PLAN_BASELINES.flatMap((baseline) =>
  baseline.tasks.map((task, index) => {
    const delta = index === 0 ? 2 : 0;
    return {
      task: task.taskId,
      code: baseline.id,
      base: task.plannedFinish,
      actual: task.plannedFinish,
      delta,
      workMinutes: task.workMinutes,
      capturedAt: baseline.capturedAt
    };
  })
);

function DeltaCell({ d }: { d: number }) {
  if (d === 0)
    return (
      <span className="delta">
        <ArrowRight className="size-4" aria-hidden /> 0
      </span>
    );
  if (d > 0)
    return (
      <span className="delta delta--down">
        <ArrowDown className="size-4" aria-hidden /> +{d} д
      </span>
    );
  return (
    <span className="delta delta--up">
      <ArrowUp className="size-4" aria-hidden /> {d} д
    </span>
  );
}

export function ProjectBaselineBlock() {
  return (
    <>
      <PageIntro
        title={mockProjectScreenTitle("Базовый план")}
        lead="Снимки плана и отклонения."
        actions={
          <>
            <Button variant="secondary">Создать снимок</Button>
            <Button variant="primary">Сравнить</Button>
          </>
        }
      />
      <CardPanel title={`Базовый план · ${formatDate(MOCK_PLAN_BASELINES[0]?.capturedAt ?? null)}`} subtitle="PlanSnapshot.baselines" flush>
        <DataTable>
          <thead>
            <tr>
              <th>Задача</th>
              <th>План</th>
              <th>Факт</th>
              <th>Δ</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.code}>
                <td>
                  <CellStack title={r.task} subtitle={r.code} />
                </td>
                <td className="mono">{formatDate(r.base)}</td>
                <td className="mono">{formatDate(r.actual)}</td>
                <td>
                  <DeltaCell d={r.delta} />
                </td>
                <td>
                  {r.delta === 0 ? (
                    <Chip variant="success">В графике</Chip>
                  ) : r.delta < 0 ? (
                    <Chip variant="info">Опережение</Chip>
                  ) : (
                    <Chip variant="warning">Отклонение</Chip>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </CardPanel>
    </>
  );
}
