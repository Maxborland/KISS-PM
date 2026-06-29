import { WorkspaceRuntimeProvider } from "@/workspace/lib/workspace-runtime";
import { MyWorkSurface } from "@/workspace/my-work/my-work-surface";

// Прод-route «Моя работа» (v3) на боевом workspace API: канбан/список задач,
// статусы и исполнители из GET /api/workspace/{my-work,task-statuses,users}.
export default function MyWorkPage() {
  return (
    <WorkspaceRuntimeProvider live>
      <MyWorkSurface />
    </WorkspaceRuntimeProvider>
  );
}
