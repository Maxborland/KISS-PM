import type { Metadata } from "next";

import { AdminRuntimeProvider } from "@/admin/lib/admin-runtime";
import { AdminControlSurfacesSurface } from "@/admin/control-surfaces/control-surfaces-surface";

// Прод-route «Администрирование · Контрол-поверхности» на боевом контракте
// /api/tenant/current/control-surfaces/* (публикация/откат панелей контроля).
export const metadata: Metadata = { title: "Контрол-поверхности — Администрирование — KISS PM" };

export default function AdminControlSurfacesPage() {
  return (
    <AdminRuntimeProvider live>
      <AdminControlSurfacesSurface />
    </AdminRuntimeProvider>
  );
}
