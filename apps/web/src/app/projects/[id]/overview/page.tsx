import type { Metadata } from "next";

import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectOverview } from "@/delivery/overview/overview-surface";

// Прод-route «Обзор проекта» (v3): сигналы из read-model + лента коммитов из audit-events.
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Обзор проекта — KISS PM" };

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectOverview projectId={id} />
    </PlanningRuntimeProvider>
  );
}
