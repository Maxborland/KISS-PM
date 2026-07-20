/* ============================================================
   Регрессия клиентского пути записи при переупорядочивании стадий.

   Чистый планировщик (pipeline-settings-model.test.ts) НЕ ловил эту находку:
   он проверял только форму плана, но не его применение против ограничения
   уникальности (tenant_id, pipeline_id, sort_order). Здесь проверяется именно
   применение — через crm-client поверх mock-crm-backend, который это ограничение
   воспроизводит (как боевой immediate-unique индекс).
   ============================================================ */

import { describe, expect, it } from "vitest";

import { createCrmClient } from "@/crm/lib/crm-client";
import { createMockCrmFetch } from "@/crm/lib/mock-crm-backend";
import { CrmApiError } from "@/crm/lib/crm-client";
import { orderedStages, planStageOrder } from "./pipeline-settings-model";

function createClient() {
  return createCrmClient({ apiOrigin: "", fetchImpl: createMockCrmFetch(), credentials: "omit" });
}

const MAIN = "pipeline-main";

describe("путь записи переупорядочивания стадий", () => {
  it("одиночный PATCH стадии в занятую позицию отвергается конфликтом, а не молча проходит", async () => {
    // Ровно тот шаг, который делал старый клиент первым при перестановке соседей.
    const client = createClient();
    const error = await client
      .updateDealStage("stage-lead", { name: "Лид", sortOrder: 2, status: "active" })
      .then(() => null, (e: unknown) => e);

    expect(error).toBeInstanceOf(CrmApiError);
    expect((error as CrmApiError).status).toBe(409);
    expect((error as CrmApiError).code).toBe("deal_stage_sort_order_taken");
  });

  it("reorderDealStages применяет план целиком и меняет порядок", async () => {
    const client = createClient();
    const before = orderedStages((await client.listDealStages()).dealStages, MAIN);
    expect(before.map((s) => s.id)).toEqual([
      "stage-lead",
      "stage-qual",
      "stage-proposal",
      "stage-contract",
      "stage-won"
    ]);

    const plan = planStageOrder(before, "stage-qual", "up");
    expect(plan).not.toBeNull();

    const result = await client.reorderDealStages(MAIN, plan!);
    expect(result.dealStages.map((s) => s.id)).toEqual([
      "stage-qual",
      "stage-lead",
      "stage-proposal",
      "stage-contract",
      "stage-won"
    ]);
    expect(result.dealStages.map((s) => s.sortOrder)).toEqual([1, 2, 3, 4, 5]);

    // Порядок виден и при последующем чтении списка.
    const after = orderedStages((await client.listDealStages()).dealStages, MAIN);
    expect(after.map((s) => s.id)).toEqual([
      "stage-qual",
      "stage-lead",
      "stage-proposal",
      "stage-contract",
      "stage-won"
    ]);
  });

  it("движение вниз и обратно возвращает исходный порядок", async () => {
    const client = createClient();
    const initial = orderedStages((await client.listDealStages()).dealStages, MAIN);

    const down = planStageOrder(initial, "stage-lead", "down")!;
    await client.reorderDealStages(MAIN, down);
    const moved = orderedStages((await client.listDealStages()).dealStages, MAIN);
    expect(moved.map((s) => s.id)[0]).toBe("stage-qual");

    const back = planStageOrder(moved, "stage-lead", "up")!;
    await client.reorderDealStages(MAIN, back);
    const restored = orderedStages((await client.listDealStages()).dealStages, MAIN);
    expect(restored.map((s) => s.id)).toEqual(initial.map((s) => s.id));
  });

  it("не трогает соседнюю воронку", async () => {
    const client = createClient();
    const stages = (await client.listDealStages()).dealStages;
    const plan = planStageOrder(stages, "stage-qual", "up")!;
    await client.reorderDealStages(MAIN, plan);

    const partner = orderedStages((await client.listDealStages()).dealStages, "pipeline-partner");
    expect(partner.map((s) => s.id)).toEqual([
      "stage-partner-lead",
      "stage-partner-poc",
      "stage-partner-won"
    ]);
  });

  it("отвергает неполный порядок", async () => {
    const client = createClient();
    const error = await client
      .reorderDealStages(MAIN, ["stage-qual", "stage-lead"])
      .then(() => null, (e: unknown) => e);

    expect((error as CrmApiError).status).toBe(400);
    expect((error as CrmApiError).code).toBe("invalid_stage_order");
  });
});
