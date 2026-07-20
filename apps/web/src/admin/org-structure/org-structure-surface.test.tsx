// @vitest-environment happy-dom

/* ============================================================
   OrgStructureEditor (org-structure-surface): презентационный редактор
   оргструктуры. Проверяем честный контракт UI:
   - дерево (направления/единицы) рендерится из снапшота;
   - режим просмотра (canManage=false) не показывает «Сохранить» и
     блокирует селекты расстановки;
   - расстановка человека (направление→отдел→должность) делает черновик
     «грязным» и уходит в onSave сериализованным телом PUT (только полные).
   ============================================================ */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrgStructureEditor } from "./org-structure-surface";
import type { OrgStructureData } from "./use-org-structure";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) }
}));
// Диалоги в портале — вне скоупа: триггер + inline-контент.
vi.mock("@/components/domain/form-dialog", () => ({
  FormDialog: ({ trigger, children }: { trigger?: React.ReactNode; children?: React.ReactNode }) => (
    <div>{trigger}{children}</div>
  )
}));
vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
}));

const TENANT = "tenant-alpha";

function data(): OrgStructureData {
  return {
    orgStructure: {
      functional: {
        nodes: [
          { id: "dir-1", tenantId: TENANT, track: "functional", nodeType: "direction", name: "Инженерия", parentId: null, sortOrder: 0 },
          { id: "dep-1", tenantId: TENANT, track: "functional", nodeType: "department", name: "Веб", parentId: "dir-1", sortOrder: 0 }
        ],
        placements: []
      },
      project: { nodes: [], placements: [] }
    },
    users: [{ id: "user-a", name: "Петров", positionId: "pos-1", positionName: "Лид" }],
    positions: [{ id: "pos-1", name: "Лид" }]
  };
}

describe("OrgStructureEditor", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  const render = async (
    canManage: boolean,
    onSave = vi.fn(async (_body: unknown) => ({ ok: true as const }))
  ) => {
    await act(async () => {
      root.render(<OrgStructureEditor data={data()} canManage={canManage} onSave={onSave} />);
    });
    return onSave;
  };

  it("рендерит дерево направлений и единиц из снапшота", async () => {
    await render(true);
    expect(host.textContent).toContain("Инженерия");
    expect(host.textContent).toContain("Веб");
    expect(host.querySelector('[data-testid="org-add-direction"]')).not.toBeNull();
  });

  it("режим просмотра: нет кнопки сохранить и селекты расстановки заблокированы", async () => {
    await render(false);
    expect(host.querySelector('[data-testid="org-structure-save"]')).toBeNull();
    expect(host.querySelector('[data-testid="org-add-direction"]')).toBeNull();
    const dirSelect = host.querySelector<HTMLSelectElement>('select[aria-label="Направление сотрудника Петров"]');
    expect(dirSelect).not.toBeNull();
    expect(dirSelect!.disabled).toBe(true);
  });

  it("полная расстановка делает черновик грязным и уходит в onSave телом PUT", async () => {
    const onSave = await render(true);

    // Изначально изменений нет — кнопка «Сохранить» задизейблена.
    const saveBtn = () => host.querySelector<HTMLButtonElement>('[data-testid="org-structure-save"]');
    expect(saveBtn()!.disabled).toBe(true);

    const setSelect = async (label: string, value: string) => {
      const select = host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
      await act(async () => {
        setter.call(select, value);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
    };

    await setSelect("Направление сотрудника Петров", "dir-1");
    // Направление задано, но единица ещё нет → расстановка неполная, сохранять нечего.
    expect(saveBtn()!.disabled).toBe(true);

    await setSelect("отдел сотрудника Петров", "dep-1");
    // Должность подставилась из user.positionId=pos-1 → расстановка полная → есть что сохранить.
    expect(host.querySelector('[data-testid="org-structure-dirty"]')).not.toBeNull();
    expect(saveBtn()!.disabled).toBe(false);

    await act(async () => saveBtn()!.click());

    expect(onSave).toHaveBeenCalledTimes(1);
    const body = onSave.mock.calls[0]![0] as unknown as {
      functional: { placements: Array<Record<string, unknown>> };
    };
    expect(body.functional.placements).toEqual([
      { userId: "user-a", directionId: "dir-1", positionId: "pos-1", departmentId: "dep-1" }
    ]);
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });
});
