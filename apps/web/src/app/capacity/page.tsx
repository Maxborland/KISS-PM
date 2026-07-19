import type { Metadata } from "next";

import { WorkspaceRuntimeProvider } from "@/workspace/lib/workspace-runtime";
import { CapacitySurface } from "@/workspace/capacity/capacity-surface";

// Прод-route «Загрузка» (Р10): матрица загрузки ресурсов на боевом workspace API
// (GET /api/workspace/capacity/tree, RBAC tenant.project_resources.read — серверный
// 403 поверхность показывает как «Доступ ограничен»).
export const metadata: Metadata = { title: "Загрузка — KISS PM" };

export default function CapacityPage() {
  return (
    <WorkspaceRuntimeProvider live>
      <CapacitySurface />
    </WorkspaceRuntimeProvider>
  );
}
