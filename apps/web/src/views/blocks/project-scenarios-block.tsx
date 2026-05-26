import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { CardPanel } from "@/components/domain/card-panel";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { formatDate, formatRub } from "@/lib/mock-data/format";
import { ScenarioFetchGate, useScenarioFixtures } from "@/lib/mock-data/scenario-context";
import { mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";

export function ProjectScenariosBlock() {
  const { fixtures } = useScenarioFixtures();
  const scenarios = fixtures.planningScenarios;

  return (
    <ScenarioFetchGate loadingLabel="Загрузка сценариев плана…">
      <>
        <PageIntro
          title={mockProjectScreenTitle("Сценарии")}
          lead="Сценарии «что если» и сравнение вариантов."
          actions={<Button variant="primary">Принять сценарий</Button>}
        />
        <CardPanel title="Сравнение" subtitle={`${scenarios.length} варианта`} flush>
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
              {scenarios.map((scenario) => (
                <tr key={scenario.id} className={scenario.recommended ? "is-selected" : undefined}>
                  <td>
                    <CellStack title={scenario.name} subtitle={scenario.id} />
                  </td>
                  <td className="mono">{formatDate(scenario.deadline)}</td>
                  <td className="mono">{formatRub(scenario.cost)}</td>
                  <td className="mono">{scenario.risk}%</td>
                  <td className="mono">{scenario.spi}</td>
                  <td>
                    {scenario.recommended ? <Chip variant="success">Рекомендован</Chip> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardPanel>
      </>
    </ScenarioFetchGate>
  );
}
