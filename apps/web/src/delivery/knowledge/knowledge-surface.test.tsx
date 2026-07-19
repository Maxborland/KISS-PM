/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KnowledgeApiError, type KnowledgeClient } from "./knowledge-client";
import { ProjectKnowledge } from "./knowledge-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/* ============================================================
   Тесты поверхности «База знаний»: RBAC-гейт мутационных контролов
   (tenant.projects.manage), три секции с реальными данными клиента,
   создание документа/версии, смена статуса поручения, forbidden (403)
   и error+retry. Клиент — инъекция фейка через проп client.
   ============================================================ */

let permissions: string[] = [];

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({ id: "user-1", tenantId: "tenant-1", name: "Test User", permissions })
}));
vi.mock("@/delivery/lib/project-chrome", () => ({
  PROJECT_FALLBACK: { name: "Проект", code: "…", status: "—", planVersion: "", deadline: "—", finish: "—" },
  useProjectBase: () => ({ name: "Проект", code: "ПР", status: "—", planVersion: "", deadline: "—", finish: "—" })
}));
vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

const NOW = "2026-07-18T10:00:00.000Z";
const baseRow = {
  tenantId: "tenant-1",
  projectId: "proj-1",
  createdByUserId: "user-1",
  createdAt: NOW,
  updatedAt: NOW,
  archivedAt: null
};

const documentFixture = {
  ...baseRow,
  id: "doc-1",
  title: "Устав проекта",
  summary: "Рамки и цели проекта",
  documentType: "project_brief" as const,
  status: "active" as const,
  currentVersionId: "ver-2",
  sourceMeetingId: null,
  approvalStatus: "approved" as const,
  approvalRequestedByUserId: null
};

const versionsFixture = [
  {
    id: "ver-1",
    tenantId: "tenant-1",
    documentId: "doc-1",
    versionNumber: 1,
    title: "Устав проекта",
    body: "Содержимое версии 1",
    summary: null,
    changeReason: null,
    createdByUserId: "user-1",
    createdAt: "2026-07-10T10:00:00.000Z"
  },
  {
    id: "ver-2",
    tenantId: "tenant-1",
    documentId: "doc-1",
    versionNumber: 2,
    title: "Устав проекта",
    body: "Содержимое версии 2",
    summary: null,
    changeReason: "Уточнение объёма",
    createdByUserId: "user-1",
    createdAt: NOW
  }
];

const decisionFixture = {
  ...baseRow,
  id: "dec-1",
  title: "Выбор стека",
  decision: "Берём PostgreSQL",
  rationale: "Опыт команды",
  status: "accepted" as const,
  sourceMeetingId: null,
  documentId: null,
  supersedesDecisionId: null
};

const actionFixture = {
  ...baseRow,
  id: "act-1",
  title: "Согласовать смету",
  description: null,
  ownerUserId: "user-2",
  dueDate: "2026-08-01",
  status: "open" as const,
  sourceMeetingId: null,
  documentId: null,
  decisionId: null,
  targetEntityType: null,
  targetEntityId: null
};

const usersFixture = [
  { id: "user-1", name: "Мария Орлова" },
  { id: "user-2", name: "Иван Крылов" }
];

function makeFakeClient() {
  const fake = {
    listDocuments: vi.fn(async () => ({ documents: [documentFixture] })),
    createDocument: vi.fn(async () => ({
      document: { ...documentFixture, id: "doc-new", title: "Регламент" },
      version: versionsFixture[1]!
    })),
    getDocument: vi.fn(async () => ({ document: documentFixture, versions: versionsFixture })),
    createDocumentVersion: vi.fn(async () => ({ document: documentFixture, version: versionsFixture[1]! })),
    listDecisions: vi.fn(async () => ({ decisions: [decisionFixture] })),
    createDecision: vi.fn(async () => ({ decision: decisionFixture })),
    listActionItems: vi.fn(async () => ({ actionItems: [actionFixture] })),
    createActionItem: vi.fn(async () => ({ actionItem: actionFixture })),
    updateActionItem: vi.fn(async () => ({ actionItem: { ...actionFixture, status: "done" as const } })),
    listUsers: vi.fn(async () => ({ users: usersFixture }))
  };
  return { fake, client: fake as unknown as KnowledgeClient };
}

async function renderSurface(client: KnowledgeClient): Promise<{ root: Root; host: HTMLDivElement }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<ProjectKnowledge projectId="proj-1" client={client} />));
  await act(async () => Promise.resolve());
  await act(async () => Promise.resolve());
  return { root, host };
}

const buttonWithExactText = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.trim() === text
  );

async function setField(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

afterEach(async () => {
  document.body.replaceChildren();
  permissions = [];
});

describe("knowledge surface RBAC", () => {
  it("keeps all three sections readable without manage controls for a read-only user", async () => {
    permissions = ["tenant.projects.read"];
    const { client } = makeFakeClient();
    const rendered = await renderSurface(client);

    // Документы: список + содержимое текущей версии.
    expect(rendered.host.textContent).toContain("Устав проекта");
    expect(rendered.host.textContent).toContain("Содержимое версии 2");
    expect(rendered.host.textContent).toContain("Мария Орлова");
    expect(buttonWithExactText("Документ")).toBeUndefined();
    expect(buttonWithExactText("Новая версия")).toBeUndefined();

    // Решения.
    await act(async () => rendered.host.querySelector<HTMLButtonElement>('[data-testid="knowledge-section-decisions"]')?.click());
    expect(rendered.host.textContent).toContain("Берём PostgreSQL");
    expect(rendered.host.textContent).toContain("Принято");
    expect(buttonWithExactText("Решение")).toBeUndefined();

    // Поручения: статус — чипом, селекта смены статуса нет.
    await act(async () => rendered.host.querySelector<HTMLButtonElement>('[data-testid="knowledge-section-actions"]')?.click());
    expect(rendered.host.textContent).toContain("Согласовать смету");
    expect(rendered.host.textContent).toContain("Иван Крылов");
    expect(rendered.host.textContent).toContain("Открыто");
    expect(rendered.host.querySelector('[data-testid="knowledge-action-row"] select')).toBeNull();
    expect(buttonWithExactText("Поручение")).toBeUndefined();

    await act(async () => rendered.root.unmount());
  });

  it("shows the forbidden state on 403 from the knowledge routes", async () => {
    permissions = [];
    const { fake, client } = makeFakeClient();
    fake.listDocuments.mockRejectedValue(new KnowledgeApiError(403, "permission_missing", { error: "permission_missing" }));

    const rendered = await renderSurface(client);
    expect(rendered.host.textContent).toContain("Нет доступа к базе знаний");
    await act(async () => rendered.root.unmount());
  });

  it("shows an honest load error and retries", async () => {
    permissions = ["tenant.projects.read"];
    const { fake, client } = makeFakeClient();
    fake.listDocuments.mockRejectedValueOnce(new KnowledgeApiError(501, "knowledge_not_configured", { error: "knowledge_not_configured" }));

    const rendered = await renderSurface(client);
    expect(rendered.host.textContent).toContain("Сервис базы знаний временно недоступен");

    const retryButton = [...rendered.host.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.includes("Повторить")
    );
    expect(retryButton).toBeDefined();
    await act(async () => retryButton?.click());
    await act(async () => Promise.resolve());
    expect(rendered.host.textContent).toContain("Устав проекта");
    await act(async () => rendered.root.unmount());
  });
});

describe("knowledge surface mutations (manage)", () => {
  it("creates a document through the dialog and reloads the lists", async () => {
    permissions = ["tenant.projects.read", "tenant.projects.manage"];
    const { fake, client } = makeFakeClient();
    const rendered = await renderSurface(client);

    await act(async () => buttonWithExactText("Документ")?.click());
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();

    const titleInput = dialog!.querySelector<HTMLInputElement>('input[placeholder="Устав проекта"]');
    const bodyInput = dialog!.querySelector<HTMLTextAreaElement>("textarea");
    expect(titleInput).not.toBeNull();
    expect(bodyInput).not.toBeNull();
    await setField(titleInput!, "Регламент коммуникаций");
    await setField(bodyInput!, "Текст регламента");

    await act(async () => buttonWithExactText("Создать")?.click());
    await act(async () => Promise.resolve());

    expect(fake.createDocument).toHaveBeenCalledWith("proj-1", {
      title: "Регламент коммуникаций",
      body: "Текст регламента",
      documentType: "general"
    });
    // Списки перечитаны после успешной мутации.
    expect(fake.listDocuments.mock.calls.length).toBeGreaterThanOrEqual(2);
    await act(async () => rendered.root.unmount());
  });

  it("creates a new version prefilled from the latest one", async () => {
    permissions = ["tenant.projects.read", "tenant.projects.manage"];
    const { fake, client } = makeFakeClient();
    const rendered = await renderSurface(client);

    await act(async () => buttonWithExactText("Новая версия")?.click());
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    // Префилл последней версией: «редактирование» = следующая версия.
    expect(dialog!.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("Содержимое версии 2");

    await act(async () => buttonWithExactText("Сохранить версию")?.click());
    await act(async () => Promise.resolve());

    expect(fake.createDocumentVersion).toHaveBeenCalledWith("proj-1", "doc-1", {
      title: "Устав проекта",
      body: "Содержимое версии 2"
    });
    await act(async () => rendered.root.unmount());
  });

  it("switches the shown version when an older one is selected", async () => {
    permissions = ["tenant.projects.read"];
    const { client } = makeFakeClient();
    const rendered = await renderSurface(client);

    const oldVersionRow = rendered.host.querySelector<HTMLButtonElement>('[data-version-id="ver-1"]');
    expect(oldVersionRow).not.toBeNull();
    await act(async () => oldVersionRow!.click());
    expect(rendered.host.querySelector('[data-testid="knowledge-version-body"]')?.textContent).toBe("Содержимое версии 1");
    await act(async () => rendered.root.unmount());
  });

  it("patches the action item status from the row select", async () => {
    permissions = ["tenant.projects.read", "tenant.projects.manage"];
    const { fake, client } = makeFakeClient();
    const rendered = await renderSurface(client);

    await act(async () => rendered.host.querySelector<HTMLButtonElement>('[data-testid="knowledge-section-actions"]')?.click());
    const select = rendered.host.querySelector<HTMLSelectElement>('[data-testid="knowledge-action-row"] select');
    expect(select).not.toBeNull();

    await act(async () => {
      select!.value = "done";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => Promise.resolve());

    expect(fake.updateActionItem).toHaveBeenCalledWith("proj-1", "act-1", { status: "done" });
    const { toast } = await import("sonner");
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Статус поручения: «Готово»");
    await act(async () => rendered.root.unmount());
  });

  it("records a decision through the dialog", async () => {
    permissions = ["tenant.projects.read", "tenant.projects.manage"];
    const { fake, client } = makeFakeClient();
    const rendered = await renderSurface(client);

    await act(async () => rendered.host.querySelector<HTMLButtonElement>('[data-testid="knowledge-section-decisions"]')?.click());
    await act(async () => buttonWithExactText("Решение")?.click());
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();

    const titleInput = dialog!.querySelector<HTMLInputElement>('input[placeholder="Выбор стека интеграции"]');
    const decisionInput = dialog!.querySelector<HTMLTextAreaElement>("textarea");
    await setField(titleInput!, "Формат отчётности");
    await setField(decisionInput!, "Еженедельный статус-отчёт");

    await act(async () => buttonWithExactText("Зафиксировать")?.click());
    await act(async () => Promise.resolve());

    expect(fake.createDecision).toHaveBeenCalledWith("proj-1", {
      title: "Формат отчётности",
      decision: "Еженедельный статус-отчёт",
      status: "accepted"
    });
    await act(async () => rendered.root.unmount());
  });
});
