import { describe, expect, it, vi } from "vitest";

import {
  createKnowledgeClient,
  knowledgeErr,
  KnowledgeApiError
} from "./knowledge-client";

/* ============================================================
   Контракт knowledge-клиента: URL/метод/тело/заголовки каждого вызова +
   разводка ошибок (DomainApiError с СЫРЫМ серверным кодом) и словарь
   knowledgeErr. Транспорт — инъекция fetchImpl (как в других доменах).
   ============================================================ */

type Call = { url: string; init?: RequestInit };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function makeClient(status: number, body: unknown) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), ...(init ? { init } : {}) });
    return jsonResponse(status, body);
  }) as unknown as typeof fetch;
  return { client: createKnowledgeClient({ apiOrigin: "https://api.test", fetchImpl }), calls };
}

describe("createKnowledgeClient", () => {
  it("reads documents, decisions and action items from the project knowledge routes", async () => {
    const { client, calls } = makeClient(200, { documents: [], decisions: [], actionItems: [], users: [] });

    await client.listDocuments("proj/1");
    await client.listDecisions("proj/1");
    await client.listActionItems("proj/1");
    await client.listUsers();

    expect(calls.map((call) => call.url)).toEqual([
      "https://api.test/api/workspace/projects/proj%2F1/knowledge/documents",
      "https://api.test/api/workspace/projects/proj%2F1/knowledge/decisions",
      "https://api.test/api/workspace/projects/proj%2F1/knowledge/action-items",
      "https://api.test/api/workspace/users"
    ]);
    // Ручки зовутся с same-origin маркером (CSRF-защита боевого API).
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers["x-kiss-pm-action"]).toBe("same-origin");
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it("sends document create/version bodies to the mutation routes", async () => {
    const { client, calls } = makeClient(201, { document: {}, version: {} });

    await client.createDocument("proj-1", {
      title: "Устав",
      body: "Текст",
      documentType: "project_brief",
      summary: "Кратко"
    });
    await client.createDocumentVersion("proj-1", "doc-1", {
      title: "Устав v2",
      body: "Текст 2",
      changeReason: "Уточнение объёма"
    });
    await client.getDocument("proj-1", "doc-1");

    expect(calls[0]?.url).toBe("https://api.test/api/workspace/projects/proj-1/knowledge/documents");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      title: "Устав",
      body: "Текст",
      documentType: "project_brief",
      summary: "Кратко"
    });
    expect(calls[1]?.url).toBe("https://api.test/api/workspace/projects/proj-1/knowledge/documents/doc-1/versions");
    expect(calls[1]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
      title: "Устав v2",
      body: "Текст 2",
      changeReason: "Уточнение объёма"
    });
    expect(calls[2]?.url).toBe("https://api.test/api/workspace/projects/proj-1/knowledge/documents/doc-1");
  });

  it("sends decision and action item mutations with their contract bodies", async () => {
    const { client, calls } = makeClient(201, { decision: {}, actionItem: {} });

    await client.createDecision("proj-1", { title: "Стек", decision: "PostgreSQL", status: "accepted" });
    await client.createActionItem("proj-1", { title: "Подготовить план", ownerUserId: "user-2", dueDate: "2026-08-01" });
    await client.updateActionItem("proj-1", "action-1", { status: "done" });

    expect(calls[0]?.url).toBe("https://api.test/api/workspace/projects/proj-1/knowledge/decisions");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ title: "Стек", decision: "PostgreSQL", status: "accepted" });
    expect(calls[1]?.url).toBe("https://api.test/api/workspace/projects/proj-1/knowledge/action-items");
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ title: "Подготовить план", ownerUserId: "user-2", dueDate: "2026-08-01" });
    expect(calls[2]?.url).toBe("https://api.test/api/workspace/projects/proj-1/knowledge/action-items/action-1");
    expect(calls[2]?.init?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({ status: "done" });
  });

  it("throws KnowledgeApiError with the raw server code on failures", async () => {
    const { client } = makeClient(403, { error: "permission_missing" });

    const error = await client.listDocuments("proj-1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(KnowledgeApiError);
    expect((error as KnowledgeApiError).status).toBe(403);
    expect((error as KnowledgeApiError).code).toBe("permission_missing");
  });

  it("surfaces the version conflict code from the versions route", async () => {
    const { client } = makeClient(409, { error: "knowledge_version_conflict" });

    const error = await client
      .createDocumentVersion("proj-1", "doc-1", { title: "t", body: "b" })
      .catch((e: unknown) => e);
    expect((error as KnowledgeApiError).code).toBe("knowledge_version_conflict");
  });
});

describe("knowledgeErr", () => {
  it("maps known codes to Russian text and keeps unknown codes honest", () => {
    expect(knowledgeErr("permission_missing")).toBe("Недостаточно прав для работы с базой знаний проекта");
    expect(knowledgeErr("knowledge_version_conflict")).toBe("Версия уже добавлена параллельно. Обновите документ и повторите");
    expect(knowledgeErr("knowledge_title_required")).toBe("Укажите название");
    expect(knowledgeErr()).toBe("Не удалось выполнить запрос к базе знаний");
    // Неизвестный код показывается как есть — причина не прячется.
    expect(knowledgeErr("weird_new_code")).toBe("weird_new_code");
  });
});
