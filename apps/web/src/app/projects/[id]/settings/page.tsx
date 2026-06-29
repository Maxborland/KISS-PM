import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectSettings } from "@/delivery/settings/settings-surface";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectSettings projectId={id} />
    </PlanningRuntimeProvider>
  );
}
