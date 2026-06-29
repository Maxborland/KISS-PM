import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectScenarios } from "@/delivery/scenarios/scenarios-surface";

export default async function ProjectScenariosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectScenarios projectId={id} />
    </PlanningRuntimeProvider>
  );
}
