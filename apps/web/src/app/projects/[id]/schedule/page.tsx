import type { Metadata } from "next";

import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectSchedule } from "@/delivery/schedule/schedule-surface";

// Прод-route поверхности «График» (WBS + Gantt) на боевом planning API.
// projectId из URL → ProjectSchedule (тот же компонент, что в Storybook); <PlanningRuntimeProvider live>
// переключает usePlanning на боевой транспорт (/api/* → Hono, cookie-сессия).
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "График проекта — KISS PM" };

export default async function ProjectSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectSchedule projectId={id} />
    </PlanningRuntimeProvider>
  );
}
