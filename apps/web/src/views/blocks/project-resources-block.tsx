import { Calendar, Filter, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";
import { ScenarioFetchGate, useScenarioFixtures } from "@/lib/mock-data/scenario-context";
import {
  getResourceMatrixMock,
  ResourceMatrix,
  ResourceMatrixLegend,
  ResourceMatrixStats
} from "@/widgets/resource-matrix";

export function ProjectResourcesBlock() {
  const { scenario } = useScenarioFixtures();
  const matrix = getResourceMatrixMock(scenario);

  return (
    <ScenarioFetchGate loadingLabel="Загрузка матрицы ресурсов…">
      <>
      <PageIntro
        title={mockProjectScreenTitle("Ресурсы")}
        lead="Дневная матрица загрузки на месяц."
        actions={
          <>
            <Button variant="ghost" size="sm">
              <Filter className="size-4" aria-hidden />
              Роли
            </Button>
            <Button variant="ghost" size="sm">
              <Calendar className="size-4" aria-hidden />
              Май 2026
            </Button>
            <Button variant="primary" size="sm">
              <Plus className="size-4" aria-hidden />
              Назначить
            </Button>
          </>
        }
      />
      <ResourceMatrixStats stats={matrix.stats} />
      <div className="u-flex u-items-center u-justify-between u-gap-3 u-mb-3">
        <ResourceMatrixLegend />
      </div>
      <ResourceMatrix data={matrix} />
      </>
    </ScenarioFetchGate>
  );
}
