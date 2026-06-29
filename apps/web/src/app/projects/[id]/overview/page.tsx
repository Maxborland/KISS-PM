import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectOverview } from "@/delivery/overview/overview-surface";

// Прод-route «Обзор проекта» (v3): сигналы из read-model + лента коммитов из audit-events.
export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectOverview projectId={id} />
    </PlanningRuntimeProvider>
  );
}
