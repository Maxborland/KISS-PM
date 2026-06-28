import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { CellStack } from "@/components/domain/cell-stack";
import { CardPanel } from "@/components/domain/card-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MOCK_PROJECT_CRM, mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";

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
            <Button variant="secondary">Создать снимок</Button>
            <Button variant="primary">Сравнить</Button>
          </>
        }
      />
      <CardPanel title="Базовый план v2 · 21.05.2026" subtitle="Сравнение с актуальным планом" flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Задача</TableHead>
              <TableHead numeric>План</TableHead>
              <TableHead numeric>Факт</TableHead>
              <TableHead numeric>Δ</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((r) => (
              <TableRow key={r.code}>
                <TableCell>
                  <CellStack title={r.task} subtitle={r.code} />
                </TableCell>
                <TableCell numeric className="mono whitespace-nowrap">
                  {r.base}
                </TableCell>
                <TableCell numeric className="mono whitespace-nowrap">
                  {r.actual}
                </TableCell>
                <TableCell numeric>
                  <DeltaCell d={r.delta} />
                </TableCell>
                <TableCell>
                  {r.delta === 0 ? (
                    <Badge variant="success">В графике</Badge>
                  ) : r.delta < 0 ? (
                    <Badge variant="info">Опережение</Badge>
                  ) : (
                    <Badge variant="warning">Отклонение</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardPanel>
    </>
  );
}
