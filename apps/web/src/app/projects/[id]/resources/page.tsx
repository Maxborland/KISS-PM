import type { Metadata } from "next";

import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectResources } from "@/delivery/resources/resources-surface";

// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Ресурсы проекта — KISS PM" };

export default async function ProjectResourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectResources projectId={id} />
    </PlanningRuntimeProvider>
  );
}
