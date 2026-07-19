import type { Metadata } from "next";

import { AdminRuntimeProvider } from "@/admin/lib/admin-runtime";
import { AdminAbsencesSurface } from "@/admin/absences/absences-surface";

// Прод-route «Администрирование · Отсутствия» (Н3) на боевом /api/tenant/current/absences.
export const metadata: Metadata = { title: "Отсутствия — Администрирование — KISS PM" };

export default function AdminAbsencesPage() {
  return (
    <AdminRuntimeProvider live>
      <AdminAbsencesSurface />
    </AdminRuntimeProvider>
  );
}
