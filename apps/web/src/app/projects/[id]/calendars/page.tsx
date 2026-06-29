import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectCalendars } from "@/delivery/calendars/calendars-surface";

export default async function ProjectCalendarsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectCalendars projectId={id} />
    </PlanningRuntimeProvider>
  );
}
