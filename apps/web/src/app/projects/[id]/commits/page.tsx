import type { Metadata } from "next";

import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectCommits } from "@/delivery/commits/commits-surface";

// Прод-route «Коммиты» (v3): журнал из GET /api/tenant/current/audit-events.
// Откат (revert) недоступен в live — audit не несёт полный before-state (latestRevert=null).
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Коммиты проекта — KISS PM" };

export default async function ProjectCommitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectCommits projectId={id} />
    </PlanningRuntimeProvider>
  );
}
