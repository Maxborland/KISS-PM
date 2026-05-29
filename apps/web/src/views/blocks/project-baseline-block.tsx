import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { useMemo } from "react";

import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { CardPanel } from "@/components/domain/card-panel";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { formatDate } from "@/lib/mock-data/format";
import { useScenarioFixtures } from "@/lib/mock-data/scenario-context";
import { mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";
import { ScreenBlockGate, ScreenBlockPanelSkeleton } from "@/views/blocks/screen-block-fetch";

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
  const { fixtures } = useScenarioFixtures();
  const rows = useMemo(
    () =>
      fixtures.planBaselines.flatMap((baseline) =>
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
      ),
    [fixtures.planBaselines]
  );

  const intro = (
    <PageIntro
      title={mockProjectScreenTitle("Базовый план")}
      lead="Снимки плана и отклонения."
      actions={
        <>
          <Button variant="secondary" disabled title="Демо Storybook: снимок подключится к API">
            Создать снимок
          </Button>
          <Button variant="primary" disabled title="Демо Storybook: сравнение подключится к API">
            Сравнить
          </Button>
        </>
      }
    />
  );

  return (
    <ScreenBlockGate
      intro={intro}
      skeleton={<ScreenBlockPanelSkeleton rows={5} withToolbar={false} />}
      errorTitle="Не удалось загрузить базовый план"
      forbiddenTitle="Нет доступа к базовому плану"
    >
      <CardPanel
        title={`Базовый план · ${formatDate(fixtures.planBaselines[0]?.capturedAt ?? null)}`}
        subtitle="Снимки плана проекта"
        flush
      >
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
              {rows.map((row) => (
                <tr key={row.code}>
                  <td>
                    <CellStack title={row.task} subtitle={row.code} />
                  </td>
                  <td className="mono">{formatDate(row.base)}</td>
                  <td className="mono">{formatDate(row.actual)}</td>
                  <td>
                    <DeltaCell d={row.delta} />
                  </td>
                  <td>
                    {row.delta === 0 ? (
                      <Chip variant="success">В графике</Chip>
                    ) : row.delta < 0 ? (
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
    </ScreenBlockGate>
  );
}
