import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectResources } from "@/delivery/resources/resources-surface";

export default async function ProjectResourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectResources projectId={id} />
    </PlanningRuntimeProvider>
  );
}
