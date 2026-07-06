import type { Metadata } from "next";

import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectScenarios } from "@/delivery/scenarios/scenarios-surface";

// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Сценарии проекта — KISS PM" };

export default async function ProjectScenariosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectScenarios projectId={id} />
    </PlanningRuntimeProvider>
  );
}
