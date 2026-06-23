import { describe, it, expect } from "vitest";

import { CrmApiError, createCrmClient, type OpportunityCreateInput } from "./crm-client";
import { createMockCrmFetch } from "./mock-crm-backend";

function client() {
  return createCrmClient({ apiOrigin: "", fetchImpl: createMockCrmFetch() });
}

const baseInput = (over: Partial<OpportunityCreateInput> = {}): OpportunityCreateInput => ({
  clientId: "client-romashka",
  primaryContactId: "ctc-romashka",
  projectTypeId: "pt-impl",
  stageId: "stage-lead",
  title: "Тестовая сделка",
  plannedStart: "2026-05-01",
  plannedFinish: "2026-08-01",
  contractValue: 1_200_000,
  plannedHourlyRate: 4000,
  probability: 50,
  demand: [{ positionId: "backend", requiredHours: 300 }],
  ...over
});

describe("contract-mock CRM backend", () => {
  it("lists seeded opportunities and ordered deal stages", async () => {
    const c = client();
    const { opportunities } = await c.listOpportunities();
    const { dealStages } = await c.listDealStages();
    expect(opportunities.length).toBeGreaterThanOrEqual(6);
    expect(opportunities.find((o) => o.id === "opp-2207")?.clientName).toBe("ООО «Ромашка»");
    expect(dealStages.map((s) => s.sortOrder)).toEqual([...dealStages.map((s) => s.sortOrder)].sort((a, b) => a - b));
  });

  it("creates an opportunity with status new and engine-computed plannedHours", async () => {
    const c = client();
    const { opportunity } = await c.createOpportunity(baseInput());
    expect(opportunity.status).toBe("new");
    expect(opportunity.plannedHours).toBe(Math.floor(1_200_000 / 4000)); // 300
    expect(opportunity.clientName).toBe("ООО «Ромашка»"); // денормализация из связи
    expect(opportunity.contactName).toBe("Петрова Анна");
    const { opportunities } = await c.listOpportunities();
    expect(opportunities.find((o) => o.id === opportunity.id)).toBeTruthy();
  });

  it("rejects creating an opportunity whose contact belongs to another client (404 contact_not_found)", async () => {
    const c = client();
    await expect(c.createOpportunity(baseInput({ primaryContactId: "ctc-sever" }))).rejects.toMatchObject({ status: 404, code: "contact_not_found" });
  });

  it("rejects creating an opportunity against an unknown client (404 client_not_found)", async () => {
    const c = client();
    await expect(c.createOpportunity(baseInput({ clientId: "client-zzz", primaryContactId: "ctc-zzz" }))).rejects.toMatchObject({ status: 404, code: "client_not_found" });
  });

  it("rejects an opportunity with finish before start (400 invalid_planned_dates)", async () => {
    const c = client();
    await expect(c.createOpportunity(baseInput({ plannedStart: "2026-08-01", plannedFinish: "2026-05-01" }))).rejects.toMatchObject({ status: 400, code: "invalid_planned_dates" });
  });

  it("moves an opportunity to another stage", async () => {
    const c = client();
    const { opportunity } = await c.moveOpportunityStage("opp-2207", "stage-won");
    expect(opportunity.stageId).toBe("stage-won");
  });

  it("rejects a stage move on a finalized opportunity (409 opportunity_stage_locked)", async () => {
    const c = client();
    // opp-sever-portal сидирован как won_closed (финальный)
    await expect(c.moveOpportunityStage("opp-sever-portal", "stage-lead")).rejects.toMatchObject({ status: 409, code: "opportunity_stage_locked" });
  });

  it("rejects a stage move to an unknown stage (404 deal_stage_not_found)", async () => {
    const c = client();
    await expect(c.moveOpportunityStage("opp-2207", "stage-zzz")).rejects.toMatchObject({ status: 404, code: "deal_stage_not_found" });
  });

  it("requires an active client when creating a contact (404 client_not_found)", async () => {
    const c = client();
    await expect(c.createContact({ clientId: "client-zzz", name: "Новый контакт" })).rejects.toMatchObject({ status: 404, code: "client_not_found" });
    const ok = await c.createContact({ clientId: "client-romashka", name: "Новый контакт", role: "Менеджер" });
    expect(ok.contact.clientId).toBe("client-romashka");
  });

  it("validates product price as a positive integer (400 invalid_product_price)", async () => {
    const c = client();
    await expect(c.createProduct({ name: "Демо", unit: "шт", price: -5 })).rejects.toBeInstanceOf(CrmApiError);
    const ok = await c.createProduct({ name: "Демо", unit: "шт", price: 1000 });
    expect(ok.product.price).toBe(1000);
  });
});
