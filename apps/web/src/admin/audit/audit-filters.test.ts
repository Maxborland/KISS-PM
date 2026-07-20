/* ============================================================
   Контрактный тест web-стороны журнала аудита: createAdminClient поверх
   contract-mock (createMockAdminFetch) строит query серверных фильтров и
   разбирает keyset-пагинацию так же, как боевой auditRoutes. Проверяем,
   что фильтры по актору/типу/результату/дате и курсор работают за пределами
   одной страницы без пропусков и дублей.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { createAdminClient } from "@/admin/lib/admin-client";
import { createMockAdminFetch } from "@/admin/lib/mock-admin-backend";

function client() {
  return createAdminClient({ apiOrigin: "", fetchImpl: createMockAdminFetch() });
}

describe("audit events web client (серверные фильтры + keyset)", () => {
  it("фильтрует по результату исполнения", async () => {
    const denied = await client().listAuditEvents({ executionResult: "denied" });
    expect(denied.auditEvents.map((e) => e.id)).toEqual(["audit-5"]);
  });

  it("фильтрует по актору", async () => {
    const byActor = await client().listAuditEvents({ actorUserId: "user-ivan" });
    expect(byActor.auditEvents.map((e) => e.id)).toEqual(["audit-3", "audit-5"]);
  });

  it("фильтрует по типу события", async () => {
    const byType = await client().listAuditEvents({ actionType: "control_surface.published" });
    expect(byType.auditEvents.map((e) => e.id)).toEqual(["audit-4"]);
  });

  it("фильтрует по диапазону дат (включительно)", async () => {
    const range = await client().listAuditEvents({
      fromDate: "2026-01-13T00:00:00.000Z",
      toDate: "2026-01-13T23:59:59.999Z"
    });
    expect(range.auditEvents.map((e) => e.id)).toEqual(["audit-3", "audit-4", "audit-5"]);
  });

  it("keyset-пагинация обходит весь журнал без пропусков и дублей", async () => {
    const api = client();
    const collected: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await api.listAuditEvents({ limit: 3, cursor });
      collected.push(...page.auditEvents.map((e) => e.id));
      cursor = page.nextCursor;
      pages += 1;
      expect(pages).toBeLessThanOrEqual(10);
    } while (cursor);

    expect(collected).toEqual([
      "audit-1", "audit-2", "audit-3", "audit-4",
      "audit-5", "audit-6", "audit-7", "audit-8"
    ]);
    expect(new Set(collected).size).toBe(collected.length);
  });
});
