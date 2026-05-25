import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { CardPanel } from "@/components/domain/card-panel";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
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
        lead="Сценарии «что если» и сравнение вариантов."
        actions={<Button variant="primary">Принять сценарий</Button>}
      />
      <CardPanel title="Сравнение" subtitle={`${SCENARIOS.length} варианта`} flush>
        <DataTable>
          <thead>
            <tr>
              <th>Сценарий</th>
              <th>Срок</th>
              <th>Бюджет</th>
              <th>Риск</th>
              <th>SPI</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {SCENARIOS.map((s) => (
              <tr key={s.id} className={s.recommended ? "is-selected" : undefined}>
                <td>
                  <CellStack title={s.name} subtitle={s.id} />
                </td>
                <td className="mono">{s.deadline}</td>
                <td className="mono">{s.cost}</td>
                <td>
                  <Chip
                    variant={s.risk === "Низкий" ? "success" : s.risk === "Средний" ? "info" : "warning"}
                  >
                    {s.risk}
                  </Chip>
                </td>
                <td className="mono">{s.spi}</td>
                <td>
                  {s.recommended ? (
                    <Chip variant="success">Рекомендуем</Chip>
                  ) : (
                    <Button variant="ghost" size="sm">
                      Принять
                    </Button>
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
