import type { Metadata } from "next";

import { AdminRuntimeProvider } from "@/admin/lib/admin-runtime";
import { AdminBackgroundJobsSurface } from "@/admin/background-jobs/background-jobs-surface";

// Прод-route «Администрирование · Фоновые задачи» (Н4, read-only) на боевом
// GET /api/workspace/background-jobs/runs.
export const metadata: Metadata = { title: "Фоновые задачи — Администрирование — KISS PM" };

export default function AdminBackgroundJobsPage() {
  return (
    <AdminRuntimeProvider live>
      <AdminBackgroundJobsSurface />
    </AdminRuntimeProvider>
  );
}
