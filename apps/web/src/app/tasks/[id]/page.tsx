import type { Metadata } from "next";

import { WorkspaceRuntimeProvider } from "@/workspace/lib/workspace-runtime";
import { TaskDetailSurface } from "@/workspace/task-peek/task-detail-surface";

export const metadata: Metadata = { title: "Задача — KISS PM" };

/** Canonical live task route: its URL id is the only detail resource requested. */
export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <WorkspaceRuntimeProvider live>
      <TaskDetailSurface taskId={id} />
    </WorkspaceRuntimeProvider>
  );
}
