import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { CardPanel } from "@/components/domain/card-panel";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { MOCK_PROJECT_CRM, mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";
import { demoAction } from "@/views/lib/demo";

const ROWS = [
  { task: "Аудит процессов", code: "MDS-1", base: "27.05", actual: "29.05", delta: 2 },
  { task: "Миграция данных", code: "MDS-12", base: "12.06", actual: "12.06", delta: 0 },
  { task: "Интеграция CRM API", code: "MDS-21", base: "20.06", actual: "18.06", delta: -2 },
  { task: "Обучение команды", code: "MDS-34", base: "30.06", actual: "05.07", delta: 5 }
];

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
            <Button variant="secondary" {...demoAction("создание снимка")}>Создать снимок</Button>
            <Button variant="primary" {...demoAction("сравнение планов")}>Сравнить</Button>
          </>
        }
      />
      <CardPanel title="Базовый план v2 · 21.05.2026" subtitle="Сравнение с актуальным планом" flush>
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
                <td className="mono">{r.base}</td>
                <td className="mono">{r.actual}</td>
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
