import { describe, expect, it } from "vitest";

import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";

import type { ApiTenantDataSource } from "../apiTypes";
import { buildActionPreview, buildProposalActionMetadata } from "./agentRoutes";

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

// ── Ревью F2: контракт редактируемого поля превью ──
// `after` у create_task — сводная фраза, а не значение поля. Клиент, посадив редактор на
// `after`, писал всю фразу в input.title (~116 символов — под лимитом 160 в
// projectWorkParsers), и задача создавалась с именем-предложением. Сервер обязан отдавать
// сырое значение поля отдельно и раскладывать превью так, чтобы after = prefix+value+suffix.
describe("agent preview: редактируемое поле объявляет сервер", () => {
  const actor: TenantUser = { id: "user-1", tenantId: "tenant-1", name: "Тест", accessProfileId: "ap" };
  const profile: AccessProfile = { id: "ap", permissions: ["tenant.projects.read"] as AccessProfile["permissions"] };

  it("create_task: editable.value = сырое title, а не сводка превью", async () => {
    const dataSource = {
      async listProjects() {
        return [{ id: "project-1", title: "Стройка" }];
      }
    } as unknown as ApiTenantDataSource;

    const metadata = await buildProposalActionMetadata(dataSource, actor, profile, {
      tool: "create_task",
      input: { title: "Согласовать смету", projectId: "project-1", plannedStart: "2026-07-20", plannedFinish: "2026-07-24" }
    });

    expect(metadata.preview.editable?.field).toBe("title");
    expect(metadata.preview.editable?.value).toBe("Согласовать смету");
    // Сводка осталась информативной — правка поля не «съедает» проект/даты/часы.
    expect(metadata.preview.after).toContain("проект «Стройка»");
    expect(metadata.preview.after).toContain("приоритет: normal");
    // Инвариант: отображение целиком выводится из редактируемого значения.
    const editable = metadata.preview.editable!;
    expect(`${editable.prefix}${editable.value}${editable.suffix}`).toBe(metadata.preview.after);
    // Пересборка после правки не тащит старое название в новое отображение.
    expect(`${editable.prefix}Другое название${editable.suffix}`).toContain("«Другое название»");
  });

  it("comment_task: editable.value = сырое тело, prefix/suffix пусты", async () => {
    const dataSource = {
      async listTaskActivities() {
        return [{ type: "comment" }, { type: "status" }];
      }
    } as unknown as ApiTenantDataSource;

    const preview = await buildActionPreview(dataSource, "tenant-1", {
      tool: "comment_task",
      input: { taskId: "task-1", body: "Смета уточнена." }
    });

    expect(preview.editable).toEqual({ field: "body", label: "Текст комментария", value: "Смета уточнена.", prefix: "", suffix: "" });
    expect(preview.after).toBe("Смета уточнена.");
    expect(preview.before).toBe("Комментариев: 1");
  });

  it("структурное действие редактируемого поля НЕ объявляет", async () => {
    const preview = await buildActionPreview(emptyDataSource, "tenant-1", {
      tool: "apply_plan_commands",
      input: { projectId: "project-1", commands: [{}], clientPlanVersion: 3 }
    });

    expect(preview.editable).toBeUndefined();
  });
});
