import type { Metadata } from "next";

import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectCalendars } from "@/delivery/calendars/calendars-surface";

// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Календари проекта — KISS PM" };

export default async function ProjectCalendarsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectCalendars projectId={id} />
    </PlanningRuntimeProvider>
  );
}
