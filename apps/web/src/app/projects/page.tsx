import type { Metadata } from "next";

import { WorkspaceRuntimeProvider } from "@/workspace/lib/workspace-runtime";
import { ProjectsListSurface } from "@/workspace/projects/projects-list-surface";

// Прод-route «Проекты» (v3): список активных проектов из GET /api/workspace/projects.
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Проекты — KISS PM" };

export default function ProjectsPage() {
  return (
    <WorkspaceRuntimeProvider live>
      <ProjectsListSurface />
    </WorkspaceRuntimeProvider>
  );
}
