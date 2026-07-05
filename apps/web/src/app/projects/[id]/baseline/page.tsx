import type { Metadata } from "next";

import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectBaseline } from "@/delivery/baseline/baseline-surface";

// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Базовый план проекта — KISS PM" };

export default async function ProjectBaselinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectBaseline projectId={id} />
    </PlanningRuntimeProvider>
  );
}
