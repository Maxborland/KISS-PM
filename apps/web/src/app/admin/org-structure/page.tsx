import type { Metadata } from "next";

import { AdminRuntimeProvider } from "@/admin/lib/admin-runtime";
import { OrgStructureSurface } from "@/admin/org-structure/org-structure-surface";

// Прод-route «Администрирование · Оргструктура» на боевом
// GET/PUT /api/tenant/current/org-structure.
export const metadata: Metadata = { title: "Оргструктура — Администрирование — KISS PM" };

export default function AdminOrgStructurePage() {
  return (
    <AdminRuntimeProvider live>
      <OrgStructureSurface />
    </AdminRuntimeProvider>
  );
}
