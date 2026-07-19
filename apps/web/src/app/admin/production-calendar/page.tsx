import type { Metadata } from "next";

import { AdminRuntimeProvider } from "@/admin/lib/admin-runtime";
import { AdminProductionCalendarSurface } from "@/admin/production-calendar/production-calendar-surface";

// Прод-route «Администрирование · Произв. календарь» (Н3) на боевом
// /api/tenant/current/production-calendar.
export const metadata: Metadata = { title: "Производственный календарь — Администрирование — KISS PM" };

export default function AdminProductionCalendarPage() {
  return (
    <AdminRuntimeProvider live>
      <AdminProductionCalendarSurface />
    </AdminRuntimeProvider>
  );
}
