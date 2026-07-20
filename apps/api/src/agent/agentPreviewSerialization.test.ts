import { describe, expect, it } from "vitest";

import type { ApiTenantDataSource } from "../apiTypes";
import { buildActionPreview } from "./agentRoutes";

// Generic-путь buildActionPreview (доменная mutation без выделенной ветки) не трогает
// dataSource — before детерминирован, поэтому пустой источник достаточен.
const emptyDataSource = {} as ApiTenantDataSource;

describe("agent preview: recursive fields serialization (generic domain mutation)", () => {
  it("раскрывает вложенный input.fields в человекочитаемые пары «ключ: значение»", async () => {
    const preview = await buildActionPreview(emptyDataSource, "tenant-1", {
      tool: "create_crm_client",
      input: { fields: { name: "Acme", email: "a@b.c", status: "active" } }
    });

    // Прежний фильтр брал только string/number верхнего уровня — fields выпадал и «после»
    // был пустым. Теперь каждое поле тела видно до подтверждения.
    expect(preview.after).toContain("name: Acme");
    expect(preview.after).toContain("email: a@b.c");
    expect(preview.after).toContain("status: active");
  });

  it("рекурсивно сериализует вложенные объекты и массивы внутри fields", async () => {
    const preview = await buildActionPreview(emptyDataSource, "tenant-1", {
      tool: "create_crm_pipeline_rule",
      input: { pipelineId: "pipe-1", fields: { fromStageId: "s1", toStageId: "s2", conditions: ["won", "signed"], meta: { source: "web" } } }
    });

    expect(preview.after).toContain("fromStageId: s1");
    expect(preview.after).toContain("conditions: [won, signed]");
    expect(preview.after).toContain("meta: { source: web }");
    // Плоские идентификаторы верхнего уровня остаются видны после полей тела.
    expect(preview.after).toContain("pipelineId: pipe-1");
  });

  it("честный фолбэк при пустых fields — не молчаливая пустая карточка", async () => {
    const preview = await buildActionPreview(emptyDataSource, "tenant-1", {
      tool: "create_crm_product",
      input: { fields: {} }
    });
    expect(preview.after).toBe("Поля не указаны");
  });

  it("не затягивает члены прототипа (__proto__/toString) в карточку", async () => {
    const preview = await buildActionPreview(emptyDataSource, "tenant-1", {
      tool: "update_crm_contact",
      input: { contactId: "c-1", fields: JSON.parse('{"firstName":"Иван","toString":"boom"}') as Record<string, unknown> }
    });
    expect(preview.after).toContain("firstName: Иван");
    expect(preview.after).toContain("toString: boom"); // собственное поле — показываем
    // но никаких унаследованных ключей помимо явно переданных
    expect(preview.after).not.toContain("hasOwnProperty");
  });
});
