import type { Metadata } from "next";

import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectSettings } from "@/delivery/settings/settings-surface";

// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Настройки проекта — KISS PM" };

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectSettings projectId={id} />
    </PlanningRuntimeProvider>
  );
}
