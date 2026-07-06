import type { Metadata } from "next";

import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectAssignments } from "@/delivery/assignments/assignments-surface";

// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Назначения проекта — KISS PM" };

export default async function ProjectAssignmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectAssignments projectId={id} />
    </PlanningRuntimeProvider>
  );
}
