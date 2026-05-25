import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { CardPanel } from "@/components/domain/card-panel";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { MOCK_PLANNING_SCENARIOS } from "@/lib/mock-data/capacity";
import { formatDate, formatRub } from "@/lib/mock-data/format";
import { mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";

const SCENARIOS = MOCK_PLANNING_SCENARIOS;

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
                <td className="mono">{formatDate(s.deadline)}</td>
                <td className="mono">{formatRub(s.cost)}</td>
                <td>
                  <Chip
                    variant={s.risk <= 20 ? "success" : s.risk <= 30 ? "info" : "warning"}
                  >
                    risk {s.risk}
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
