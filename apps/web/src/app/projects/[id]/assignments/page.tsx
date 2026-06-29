import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectAssignments } from "@/delivery/assignments/assignments-surface";

export default async function ProjectAssignmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectAssignments projectId={id} />
    </PlanningRuntimeProvider>
  );
}
