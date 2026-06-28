import { CellStack } from "@/components/domain/cell-stack";
import { CardPanel } from "@/components/domain/card-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";

const SCENARIOS = [
  { id: "S-1", name: "Базовый", deadline: "12.06", cost: "890 000 ₽", risk: "Средний", spi: "0.94", recommended: false },
  { id: "S-2", name: "Ускоренный (+1 dev)", deadline: "05.06", cost: "1 050 000 ₽", risk: "Низкий", spi: "1.02", recommended: true },
  { id: "S-3", name: "Бережный (-1 dev)", deadline: "26.06", cost: "780 000 ₽", risk: "Высокий", spi: "0.81", recommended: false }
];

export function ProjectScenariosBlock() {
  return (
    <>
      <PageIntro
        title={mockProjectScreenTitle("Сценарии")}
        lead="What-if и сравнение вариантов."
        actions={<Button variant="primary">Принять сценарий</Button>}
      />
      <CardPanel title="Сравнение" subtitle={`${SCENARIOS.length} варианта`} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Сценарий</TableHead>
              <TableHead numeric>Срок</TableHead>
              <TableHead numeric>Бюджет</TableHead>
              <TableHead>Риск</TableHead>
              <TableHead numeric>SPI</TableHead>
              <TableHead>
                <span className="sr-only">Действия</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SCENARIOS.map((s) => (
              <TableRow key={s.id} data-state={s.recommended ? "selected" : undefined}>
                <TableCell>
                  <CellStack title={s.name} subtitle={s.id} />
                </TableCell>
                <TableCell numeric className="whitespace-nowrap">
                  {s.deadline}
                </TableCell>
                <TableCell numeric className="whitespace-nowrap">
                  {s.cost}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={s.risk === "Низкий" ? "success" : s.risk === "Средний" ? "info" : "warning"}
                  >
                    {s.risk}
                  </Badge>
                </TableCell>
                <TableCell numeric className="whitespace-nowrap">
                  {s.spi}
                </TableCell>
                <TableCell align="right">
                  {s.recommended ? (
                    <Badge variant="success">Рекомендуем</Badge>
                  ) : (
                    <Button variant="ghost" size="sm">
                      Принять
                    </Button>
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
