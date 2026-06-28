import { WorkspaceRuntimeProvider } from "@/workspace/lib/workspace-runtime";
import { ProjectsListSurface } from "@/workspace/projects/projects-list-surface";

// Прод-route «Проекты» (v3): список активных проектов из GET /api/workspace/projects.
export default function ProjectsPage() {
  return (
    <WorkspaceRuntimeProvider live>
      <ProjectsListSurface />
    </WorkspaceRuntimeProvider>
  );
}
