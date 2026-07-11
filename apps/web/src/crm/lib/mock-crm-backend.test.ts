import { describe, it, expect } from "vitest";

import { CrmApiError, createCrmClient, type OpportunityCreateInput, type OpportunityUpdateInput } from "./crm-client";
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
    // opp-gamma-mvp на stage-qual → stage-proposal: объявленный переход основной воронки без гварда.
    const { opportunity } = await c.moveOpportunityStage("opp-gamma-mvp", "stage-proposal");
    expect(opportunity.stageId).toBe("stage-proposal");
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

  // ===== контракт-верность валидации (зеркало apps/api) =====
  it("returns invalid_* (400), not *_not_found (404), for malformed link ids on create", async () => {
    const c = client();
    await expect(c.createOpportunity(baseInput({ clientId: "Bad Id" }))).rejects.toMatchObject({ status: 400, code: "invalid_client_id" });
    await expect(c.createOpportunity(baseInput({ stageId: "ZZZ!" }))).rejects.toMatchObject({ status: 400, code: "invalid_deal_stage_id" });
  });

  it("validates ownerUserId: malformed → 400, unknown well-formed → 404 owner_user_not_found", async () => {
    const c = client();
    await expect(c.createOpportunity(baseInput({ ownerUserId: "BAD" }))).rejects.toMatchObject({ status: 400, code: "invalid_owner_user_id" });
    await expect(c.createOpportunity(baseInput({ ownerUserId: "u-ghost" }))).rejects.toMatchObject({ status: 404, code: "owner_user_not_found" });
    const ok = await c.createOpportunity(baseInput({ ownerUserId: "u-ivan" }));
    expect(ok.opportunity.ownerUserId).toBe("u-ivan");
  });

  it("enforces demand bounds: hours ≤ 100000 and no duplicate positions", async () => {
    const c = client();
    await expect(c.createOpportunity(baseInput({ demand: [{ positionId: "backend", requiredHours: 200_000 }] }))).rejects.toMatchObject({ status: 400, code: "invalid_demand_hours" });
    await expect(c.createOpportunity(baseInput({ demand: [{ positionId: "backend", requiredHours: 100 }, { positionId: "backend", requiredHours: 50 }] }))).rejects.toMatchObject({ status: 400, code: "duplicate_demand_position" });
  });

  it("rejects a planning horizon over 730 days (400 invalid_planned_dates)", async () => {
    const c = client();
    await expect(c.createOpportunity(baseInput({ plannedStart: "2026-01-01", plannedFinish: "2028-06-01" }))).rejects.toMatchObject({ status: 400, code: "invalid_planned_dates" });
  });

  it("lowercases and validates contact email (400 invalid_contact_email)", async () => {
    const c = client();
    await expect(c.createContact({ clientId: "client-romashka", name: "Бад", email: "not-an-email" })).rejects.toMatchObject({ status: 400, code: "invalid_contact_email" });
    const ok = await c.createContact({ clientId: "client-romashka", name: "Ок", email: "Unique@ROMASHKA.RU" });
    expect(ok.contact.email).toBe("unique@romashka.ru");
  });

  it("rejects duplicate contact emails on create and update (409 contact_email_taken)", async () => {
    const c = client();
    const first = await c.createContact({ clientId: "client-romashka", name: "Первый", email: "Dup@Example.test" });
    const second = await c.createContact({ clientId: "client-romashka", name: "Второй", email: "other@example.test" });

    await expect(c.createContact({ clientId: "client-romashka", name: "Дубль", email: "dup@example.test" })).rejects.toMatchObject({ status: 409, code: "contact_email_taken" });
    await expect(c.updateContact(second.contact.id, { clientId: second.contact.clientId, name: second.contact.name, email: first.contact.email, phone: null, telegram: null, role: null, status: second.contact.status })).rejects.toMatchObject({ status: 409, code: "contact_email_taken" });
  });

  it("stage move with malformed stageId returns invalid_deal_stage_id (400)", async () => {
    const c = client();
    await expect(c.moveOpportunityStage("opp-2207", "ZZZ!")).rejects.toMatchObject({ status: 400, code: "invalid_deal_stage_id" });
  });

  it("archives/restores a client via full-replace PATCH (как боевой: name обязателен)", async () => {
    const c = client();
    const created = await c.createClient({ name: "ООО «Тест»" });
    expect(created.client.status).toBe("active");
    // боевой PATCH — full-replace: status без name отвергается (400)
    await expect(c.updateClient(created.client.id, { status: "archived" })).rejects.toMatchObject({ status: 400, code: "invalid_client_name" });
    const archived = await c.updateClient(created.client.id, { name: created.client.name, status: "archived" });
    expect(archived.client.status).toBe("archived");
    const restored = await c.updateClient(created.client.id, { name: created.client.name, status: "active" });
    expect(restored.client.status).toBe("active");
  });

  it("creates a product (service, positive price) and lists it", async () => {
    const c = client();
    const { product } = await c.createProduct({ name: "Консультация", unit: "час", price: 5000, type: "service" });
    expect(product).toMatchObject({ type: "service", unit: "час", price: 5000, status: "active" });
    const { products } = await c.listProducts();
    expect(products.find((p) => p.id === product.id)).toBeTruthy();
  });

  // ===== мультиворонки: воронки, правила переходов, гварды, кросс-пайплайн =====
  it("lists pipelines (≥2) and stage-transitions including the guarded contract→won rule", async () => {
    const c = client();
    const { pipelines } = await c.listPipelines();
    expect(pipelines.length).toBeGreaterThanOrEqual(2);
    expect(pipelines.find((p) => p.id === "pipeline-main")?.isDefault).toBe(true);
    expect(pipelines.find((p) => p.id === "pipeline-partner")).toBeTruthy();

    const { stageTransitions } = await c.listStageTransitions("pipeline-main");
    const guard = stageTransitions.find((t) => t.fromStageId === "stage-contract" && t.toStageId === "stage-won");
    expect(guard).toMatchObject({ requireFeasibilityOk: true, minProbability: 50 });
  });

  it("deal stages and opportunities expose pipelineId", async () => {
    const c = client();
    const { dealStages } = await c.listDealStages();
    expect(dealStages.find((s) => s.id === "stage-contract")?.pipelineId).toBe("pipeline-main");
    expect(dealStages.find((s) => s.id === "stage-partner-poc")?.pipelineId).toBe("pipeline-partner");
    const { opportunities } = await c.listOpportunities();
    expect(opportunities.find((o) => o.id === "opp-2207")?.pipelineId).toBe("pipeline-main");
    expect(opportunities.find((o) => o.id === "opp-partner-acme")?.pipelineId).toBe("pipeline-partner");
  });

  it("blocks the guarded contract→won move when feasibility is not ok (422 condition_feasibility)", async () => {
    const c = client();
    // opp-2207: на contract, prob 80 (≥50) но feasibility=null (≠ok) → отклоняется по реализуемости.
    await expect(c.moveOpportunityStage("opp-2207", "stage-won")).rejects.toMatchObject({ status: 422, code: "condition_feasibility" });
  });

  it("allows the guarded contract→won move when feasibility=ok and probability ≥ 50", async () => {
    const c = client();
    // opp-gamma-contract: на contract, feasibility=ok, prob 75 → переход разрешён.
    const { opportunity } = await c.moveOpportunityStage("opp-gamma-contract", "stage-won");
    expect(opportunity.stageId).toBe("stage-won");
    expect(opportunity.pipelineId).toBe("pipeline-main");
  });

  it("blocks the guarded move when probability < 50 even with feasibility=ok (422 condition_probability)", async () => {
    const c = client();
    // opp-sever-contract-lowprob: на contract, feasibility=ok, prob 40 (<50) → отклоняется по вероятности.
    // Домен проверяет вероятность РАНЬШЕ реализуемости, поэтому код именно condition_probability.
    await expect(c.moveOpportunityStage("opp-sever-contract-lowprob", "stage-won")).rejects.toMatchObject({ status: 422, code: "condition_probability" });
  });

  it("rejects a move that is not in the pipeline transition chain (409 transition_not_allowed)", async () => {
    const c = client();
    // opp-delta-audit на stage-lead; lead→won не объявлен цепочкой основной воронки.
    await expect(c.moveOpportunityStage("opp-delta-audit", "stage-won")).rejects.toMatchObject({ status: 409, code: "transition_not_allowed" });
  });

  it("moves an opportunity across pipelines onto a stage of the target pipeline (pipelineId switches)", async () => {
    const c = client();
    const { opportunity } = await c.moveOpportunityPipeline("opp-delta-audit", { pipelineId: "pipeline-partner", stageId: "stage-partner-lead" });
    expect(opportunity.pipelineId).toBe("pipeline-partner");
    expect(opportunity.stageId).toBe("stage-partner-lead");
  });

  it("rejects a cross-pipeline move onto a stage of another pipeline (409 stage_not_in_pipeline)", async () => {
    const c = client();
    // Целевая воронка partner, но стадия из main → домен evaluatePipelineChange → stage_not_in_pipeline.
    await expect(c.moveOpportunityPipeline("opp-delta-audit", { pipelineId: "pipeline-partner", stageId: "stage-contract" })).rejects.toMatchObject({ status: 409, code: "stage_not_in_pipeline" });
  });

  it("rejects a cross-pipeline move of a finalized opportunity (409 opportunity_finalized)", async () => {
    const c = client();
    // opp-sever-portal — won_closed (финальная).
    await expect(c.moveOpportunityPipeline("opp-sever-portal", { pipelineId: "pipeline-partner", stageId: "stage-partner-lead" })).rejects.toMatchObject({ status: 409, code: "opportunity_finalized" });
  });

  it("back-compat: a move between partner-pipeline stages (no guards) is allowed", async () => {
    const c = client();
    const { opportunity } = await c.moveOpportunityStage("opp-partner-acme", "stage-partner-poc");
    expect(opportunity.stageId).toBe("stage-partner-poc");
    expect(opportunity.pipelineId).toBe("pipeline-partner");
  });

  it("creates a stage-transition and rejects a duplicate (409 stage_transition_conflict)", async () => {
    const c = client();
    // Новый переход lead→proposal в основной воронке (его нет в цепочке) — ok.
    const { stageTransition } = await c.createStageTransition("pipeline-main", { fromStageId: "stage-lead", toStageId: "stage-proposal" });
    expect(stageTransition.pipelineId).toBe("pipeline-main");
    // Повтор той же пары → конфликт.
    await expect(c.createStageTransition("pipeline-main", { fromStageId: "stage-lead", toStageId: "stage-proposal" })).rejects.toMatchObject({ status: 409, code: "stage_transition_conflict" });
  });

  it("rejects a stage-transition whose stage belongs to another pipeline (400 stage_not_in_pipeline)", async () => {
    const c = client();
    await expect(c.createStageTransition("pipeline-main", { fromStageId: "stage-lead", toStageId: "stage-partner-poc" })).rejects.toMatchObject({ status: 400, code: "stage_not_in_pipeline" });
  });

  it("deletes a stage-transition; deleting via the wrong pipeline returns 404", async () => {
    const c = client();
    const created = await c.createStageTransition("pipeline-main", { fromStageId: "stage-lead", toStageId: "stage-contract" });
    // Удаление через чужую воронку → not_found.
    await expect(c.deleteStageTransition("pipeline-partner", created.stageTransition.id)).rejects.toMatchObject({ status: 404, code: "stage_transition_not_found" });
    const ok = await c.deleteStageTransition("pipeline-main", created.stageTransition.id);
    expect(ok.status).toBe("ok");
  });

  it("creates a pipeline and lists it", async () => {
    const c = client();
    const { pipeline } = await c.createPipeline({ name: "Тендеры", sortOrder: 3 });
    expect(pipeline).toMatchObject({ name: "Тендеры", sortOrder: 3, isDefault: false, status: "active" });
    const { pipelines } = await c.listPipelines();
    expect(pipelines.find((p) => p.id === pipeline.id)).toBeTruthy();
  });

  // ===== Карточка сделки: full-replace update =====
  const updateInput = (over: Partial<OpportunityUpdateInput> = {}): OpportunityUpdateInput => ({
    ...baseInput(over),
    templateId: null,
    customFieldValues: {},
    ...over
  });

  it("updates an opportunity (full-replace): recomputes plannedHours, preserves status, derives pipelineId, resets feasibility", async () => {
    const c = client();
    const before = (await c.getOpportunity("opp-2207")).opportunity;
    // та же стадия (stage-contract) → guard перехода не срабатывает; проверяем server-managed поля
    const { opportunity } = await c.updateOpportunity("opp-2207", updateInput({
      clientId: "client-romashka", primaryContactId: "ctc-romashka", projectTypeId: "pt-impl", stageId: "stage-contract",
      title: "Производственный портал · Релиз 2 (обновлён)", contractValue: 6_000_000, plannedHourlyRate: 5000,
      plannedStart: "2026-03-02", plannedFinish: "2026-07-12", probability: 70, demand: [{ positionId: "backend", requiredHours: 900 }],
      templateId: "template-enterprise", customFieldValues: { priority_model: "  Высокий  ", empty_note: "   " }
    }));
    expect(opportunity.plannedHours).toBe(Math.floor(6_000_000 / 5000)); // 1200, пересчитан доменом
    expect(opportunity.status).toBe(before.status); // статус СОХРАНЁН (PATCH не меняет статус)
    expect(opportunity.pipelineId).toBe(before.pipelineId); // pipelineId выведен из целевой стадии (та же — не меняется)
    expect(opportunity.stageId).toBe("stage-contract");
    expect(opportunity.feasibilityStatus).toBeNull(); // feasibility сброшен (как боевой repo.updateOpportunity)
    expect(opportunity.title).toBe("Производственный портал · Релиз 2 (обновлён)");
    expect(opportunity.templateId).toBe("template-enterprise");
    expect(opportunity.customFieldValues).toEqual({ priority_model: "Высокий" });
  });

  it.each([
    ["array", [], "invalid_custom_field_values"],
    ["too many fields", Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`field_${index}`, "x"])), "invalid_custom_field_values"],
    ["unsafe key", { constructor: "pollution" }, "invalid_custom_field_key"],
    ["object value", { priority_model: {} }, "invalid_custom_field_value"],
    ["multiline value", { priority_model: "Высокий\nскрытая строка" }, "invalid_custom_field_value"]
  ])("rejects %s in full-replace custom fields", async (_case, customFieldValues, code) => {
    const c = client();
    await expect(
      c.updateOpportunity("opp-2207", updateInput({
        customFieldValues: customFieldValues as Record<string, string>
      }))
    ).rejects.toMatchObject({ status: 400, code });
  });

  it("full-replace update enforces stage transition guards (как боевой updateOpportunityCommand)", async () => {
    const c = client();
    // обратный переход stage-contract → stage-proposal не описан правилом → отклоняется (как /stage)
    await expect(
      c.updateOpportunity("opp-2207", updateInput({
        clientId: "client-romashka", primaryContactId: "ctc-romashka", projectTypeId: "pt-impl", stageId: "stage-proposal",
        title: "Назад в proposal", contractValue: 6_000_000, plannedHourlyRate: 5000,
        plannedStart: "2026-03-02", plannedFinish: "2026-07-12", probability: 70, demand: [{ positionId: "backend", requiredHours: 900 }]
      }))
    ).rejects.toMatchObject({ status: 409, code: "transition_not_allowed" });
  });

  it("rejects updating a finalized opportunity (409 opportunity_update_locked)", async () => {
    const c = client();
    await expect(c.updateOpportunity("opp-sever-portal", updateInput())).rejects.toMatchObject({ status: 409, code: "opportunity_update_locked" });
  });

  it("update validates body: malformed contractValue → 400 invalid_contract_value", async () => {
    const c = client();
    await expect(c.updateOpportunity("opp-2207", updateInput({ contractValue: -1 }))).rejects.toMatchObject({ status: 400, code: "invalid_contract_value" });
  });

  it("update with malformed :id returns 400 invalid_opportunity_id", async () => {
    const c = client();
    await expect(c.updateOpportunity("Bad Id", updateInput())).rejects.toMatchObject({ status: 400, code: "invalid_opportunity_id" });
  });

  // ===== Карточка сделки: feasibility =====
  it("checks feasibility on a non-final opportunity: 200 assessment, records status/result/checkedAt, sets status", async () => {
    const c = client();
    const { opportunity, assessment } = await c.checkFeasibility("opp-gamma-contract"); // ok-кейс (req==plannedHours)
    expect(assessment.status).toBe("ok");
    expect(opportunity.feasibilityStatus).toBe("ok");
    expect(opportunity.feasibilityResult).toMatchObject({ status: "ok" });
    expect(opportunity.feasibilityCheckedAt).not.toBeNull();
    expect(opportunity.status).toBe("ready_to_activate"); // ok|warning → ready_to_activate
  });

  it("feasibility yields different statuses for different deals (ok / warning / conflict)", async () => {
    const c = client();
    const ok = (await c.checkFeasibility("opp-gamma-contract")).assessment.status;
    const warning = (await c.checkFeasibility("opp-2207")).assessment.status; // req 1100 < plannedHours 1200 → warning
    const conflict = (await c.checkFeasibility("opp-conflict-demo")).assessment; // 100ч спроса > 48ч доступной ёмкости
    expect(ok).toBe("ok");
    expect(warning).toBe("warning");
    expect(conflict.status).toBe("conflict");
    expect(conflict).toMatchObject({ blockers: [], rows: [{ status: "conflict" }] });
    expect(conflict.rows[0]?.shortageHours).toBeGreaterThan(0);
    // conflict-сделка переводится в status "feasibility", не ready_to_activate
    expect((await c.getOpportunity("opp-conflict-demo")).opportunity.status).toBe("feasibility");
  });

  it("rejects feasibility on a finalized opportunity (409 opportunity_not_feasible)", async () => {
    const c = client();
    await expect(c.checkFeasibility("opp-sever-portal")).rejects.toMatchObject({ status: 409, code: "opportunity_not_feasible" });
  });

  // ===== Карточка сделки: activate + projects =====
  it("requires a feasibility check before activation (400 feasibility_required)", async () => {
    const c = client();
    // opp-sever-erp: feasibilityStatus=null до проверки.
    await expect(c.activate("opp-sever-erp")).rejects.toMatchObject({ status: 400, code: "feasibility_required" });
  });

  it("activates an opportunity after an ok/warning feasibility check: 201 project, deal → won_closed, project in listProjects", async () => {
    const c = client();
    expect((await c.listProjects()).projects).toEqual([]); // пусто до активации
    await c.checkFeasibility("opp-gamma-contract"); // ok
    const { project } = await c.activate("opp-gamma-contract");
    expect(project).toMatchObject({ sourceType: "opportunity", sourceOpportunityId: "opp-gamma-contract", status: "active" });
    expect((await c.getOpportunity("opp-gamma-contract")).opportunity.status).toBe("won_closed");
    const { projects } = await c.listProjects();
    expect(projects.find((p) => p.id === project.id)).toBeTruthy();
    // повторная активация ловится финал-проверкой (сделка уже won_closed).
    await expect(c.activate("opp-gamma-contract")).rejects.toMatchObject({ status: 409, code: "opportunity_not_activatable" });
  });

  it("conflict feasibility blocks activation without risk acceptance, allows it with a reason", async () => {
    const c = client();
    const a = await c.checkFeasibility("opp-conflict-demo");
    expect(a.assessment.status).toBe("conflict");
    await expect(c.activate("opp-conflict-demo")).rejects.toMatchObject({ status: 409, code: "risk_acceptance_required" });
    const { project } = await c.activate("opp-conflict-demo", { acceptedRiskReason: "Приняли риск перегруза" });
    expect(project.sourceOpportunityId).toBe("opp-conflict-demo");
    expect((await c.getOpportunity("opp-conflict-demo")).opportunity.status).toBe("won_closed");
  });

  it("listProjects returns only active projects", async () => {
    const c = client();
    await c.checkFeasibility("opp-gamma-contract");
    await c.activate("opp-gamma-contract");
    const { projects } = await c.listProjects();
    expect(projects.length).toBeGreaterThanOrEqual(1);
    expect(projects.every((p) => p.status === "active")).toBe(true);
  });

  // ===== CRM-активности =====
  it("lists seeded activities for opp-2207, sorted createdAt desc", async () => {
    const c = client();
    const feed = await c.listActivities("opportunity", "opp-2207");
    expect(feed.activities.length).toBeGreaterThanOrEqual(4);
    expect(feed.canReadRawAudit).toBe(false);
    expect(feed.auditEvents).toBeNull();
    const created = feed.activities.map((a) => a.createdAt);
    expect(created).toEqual([...created].sort((x, y) => y.localeCompare(x)));
  });

  it("creates a comment (201), and rejects it on a finalized opportunity (409 crm_activity_locked)", async () => {
    const c = client();
    const { activity } = await c.createComment("opportunity", "opp-2207", "Новый комментарий");
    expect(activity).toMatchObject({ type: "comment", body: "Новый комментарий", authorUserId: "u-anna" });
    await expect(c.createComment("opportunity", "opp-sever-portal", "Поздно")).rejects.toMatchObject({ status: 409, code: "crm_activity_locked" });
  });

  it("rejects a task with an invalid assignee (400 task_assignee_invalid)", async () => {
    const c = client();
    await expect(c.createTask("opportunity", "opp-2207", { title: "Задача", assigneeUserId: "u-ghost" })).rejects.toMatchObject({ status: 400, code: "task_assignee_invalid" });
  });

  it("transitions a task todo→done (200), and rejects a non-task id (404 crm_task_not_found)", async () => {
    const c = client();
    const done = await c.updateTaskStatus("opportunity", "opp-2207", "crm-activity-3", "done");
    expect(done.activity.status).toBe("done");
    // crm-activity-1 — это comment, не task → not found как задача.
    await expect(c.updateTaskStatus("opportunity", "opp-2207", "crm-activity-1", "done")).rejects.toMatchObject({ status: 404, code: "crm_task_not_found" });
  });

  it("rejects an invalid entityType (400 crm_entity_type_invalid)", async () => {
    const c = client();
    await expect(c.listActivities("widget" as never, "opp-2207")).rejects.toMatchObject({ status: 400, code: "crm_entity_type_invalid" });
  });
});
