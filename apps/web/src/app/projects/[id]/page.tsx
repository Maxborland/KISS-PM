import type { Metadata } from "next";

import { WorkspaceRuntimeProvider } from "@/workspace/lib/workspace-runtime";
import { ProjectDetailSurface } from "@/workspace/project-detail/project-detail-surface";

// Прод-route «Карточка проекта» (v3): проект + задачи из GET /api/workspace/projects/:id.
// id из URL → стартовый выбранный проект (внутри surface — переключатель по списку активных).
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Карточка проекта — KISS PM" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <WorkspaceRuntimeProvider live>
      <ProjectDetailSurface initialProjectId={id} />
    </WorkspaceRuntimeProvider>
  );
}
