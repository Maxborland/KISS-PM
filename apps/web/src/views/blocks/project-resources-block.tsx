import { Calendar, Filter, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { mockProjectScreenTitle } from "@/views/catalog";
import { demoAction } from "@/views/lib/demo";
import { PageIntro } from "@/views/layout/page-intro";
import {
  RESOURCE_MATRIX_MOCK,
  ResourceMatrix,
  ResourceMatrixLegend,
  ResourceMatrixStats
} from "@/widgets/resource-matrix";

export function ProjectResourcesBlock() {
  return (
    <>
      <PageIntro
        title={mockProjectScreenTitle("Ресурсы")}
        lead="Дневная матрица загрузки на месяц."
        actions={
          <>
            <Button variant="ghost" size="sm" {...demoAction("фильтр по ролям")}>
              <Filter className="size-4" aria-hidden />
              Роли
            </Button>
            <Button variant="ghost" size="sm" {...demoAction("выбор месяца")}>
              <Calendar className="size-4" aria-hidden />
              Май 2026
            </Button>
            <Button variant="primary" size="sm" {...demoAction("назначение ресурса")}>
              <Plus className="size-4" aria-hidden />
              Назначить
            </Button>
          </>
        }
      />
      <ResourceMatrixStats stats={RESOURCE_MATRIX_MOCK.stats} />
      <div className="u-flex u-items-center u-justify-between u-gap-3 u-mb-3">
        <ResourceMatrixLegend />
      </div>
      <ResourceMatrix data={RESOURCE_MATRIX_MOCK} />
    </>
  );
}
