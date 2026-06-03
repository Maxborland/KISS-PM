"use client";

import { CardPanel } from "@/components/domain/card-panel";
import { EmptyState } from "@/components/ui/empty-state";
import type { Project } from "@/lib/api-types";
import { RoutePageIntro } from "@/views/layout/route-page-intro";
import {
  ResourceMatrix,
  ResourceMatrixLegend,
  ResourceMatrixStats,
  type ResourceMatrixData
} from "@/widgets/resource-matrix";

export function ProjectResourcesRuntimeBlock({
  matrix,
  project
}: {
  matrix: ResourceMatrixData;
  project: Project;
}) {
  return (
    <>
      <RoutePageIntro
        lead={`Живая ресурсная матрица проекта «${project.title}»: ответственные, плановые часы и перегруз по дням.`}
      />
      <CardPanel title="Ресурсная загрузка" subtitle={project.clientName} flush>
        {matrix.rows.length === 0 ? (
          <EmptyState
            title="Назначений нет"
            description="В проекте пока нет активных задач с ответственными и плановой трудоемкостью."
          />
        ) : (
          <>
            <ResourceMatrixStats stats={matrix.stats} />
            <div className="u-flex u-items-center u-justify-between u-gap-3 u-mb-3">
              <ResourceMatrixLegend />
            </div>
            <ResourceMatrix data={matrix} />
          </>
        )}
      </CardPanel>
    </>
  );
}
