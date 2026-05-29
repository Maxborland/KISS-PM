import { Calendar, Filter, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useScenarioFixtures } from "@/lib/mock-data/scenario-context";
import { RoutePageIntro } from "@/views/layout/route-page-intro";
import { ScreenBlockGate } from "@/views/blocks/screen-block-fetch";
import {
  getResourceMatrixMock,
  ResourceMatrix,
  ResourceMatrixLegend,
  ResourceMatrixStats
} from "@/widgets/resource-matrix";

function ResourceMatrixSkeleton() {
  return (
    <div className="screen-block-skeleton__matrix" aria-busy="true" aria-label="Загрузка матрицы ресурсов">
      <div className="screen-block-skeleton__matrix-stats">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} variant="block" className="screen-block-skeleton__stat" />
        ))}
      </div>
      <Skeleton variant="block" className="screen-block-skeleton__matrix-grid" />
    </div>
  );
}

export function ProjectResourcesBlock() {
  const { scenario } = useScenarioFixtures();
  const matrix = getResourceMatrixMock(scenario);

  const intro = (
    <RoutePageIntro
      actions={
        <>
          <Button variant="ghost" size="sm" disabled title="Демо Storybook: фильтр ролей подключится к API">
            <Filter className="size-4" aria-hidden />
            Роли
          </Button>
          <Button variant="ghost" size="sm" disabled title="Демо Storybook: период подключится к API">
            <Calendar className="size-4" aria-hidden />
            Май 2026
          </Button>
          <Button variant="primary" size="sm" disabled title="Демо Storybook: назначение подключится к API">
            <Plus className="size-4" aria-hidden />
            Назначить
          </Button>
        </>
      }
    />
  );

  return (
    <ScreenBlockGate
      intro={intro}
      skeleton={<ResourceMatrixSkeleton />}
      errorTitle="Не удалось загрузить матрицу ресурсов"
      forbiddenTitle="Нет доступа к ресурсам проекта"
    >
      <ResourceMatrixStats stats={matrix.stats} />
      <div className="u-flex u-items-center u-justify-between u-gap-3 u-mb-3">
        <ResourceMatrixLegend />
      </div>
      <ResourceMatrix data={matrix} />
    </ScreenBlockGate>
  );
}
