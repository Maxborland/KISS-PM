import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectBaseline } from "@/delivery/baseline/baseline-surface";

export default async function ProjectBaselinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectBaseline projectId={id} />
    </PlanningRuntimeProvider>
  );
}
