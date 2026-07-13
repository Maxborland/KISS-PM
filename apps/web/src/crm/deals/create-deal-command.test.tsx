// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateDealDialog, hasCreateDealReferenceData } from "./deals-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const clearCreateParam = vi.fn();
const toastError = vi.fn();

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("create=deal&deal=deal-existing") }));
vi.mock("@/workspace/lib/url-peek", () => ({ useUrlPeekParamCleaner: () => clearCreateParam }));
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() } }));
vi.mock("@/components/domain/form-dialog", () => ({
  FormDialog: ({ title, open, onOpenChange }: { title: string; open?: boolean; onOpenChange?: (open: boolean) => void }) => (
    <button type="button" data-testid="deal-dialog" data-open={String(open)} onClick={() => onOpenChange?.(false)}>{title}</button>
  )
}));

const data = { clients: [], contacts: [], projectTypes: [] } as never;

describe("CreateDealDialog command query", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    clearCreateParam.mockReset();
    toastError.mockReset();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("opens the real form from ?create=deal and clears only through the create-param cleaner on close", async () => {
    await act(async () => root.render(<CreateDealDialog stages={[]} data={data} busy={false} setBusy={vi.fn()} create={vi.fn() as never} disabledReason={null} />));
    const dialog = document.querySelector<HTMLButtonElement>('[data-testid="deal-dialog"]');
    expect(dialog?.dataset.open).toBe("true");
    await act(async () => dialog?.click());
    expect(clearCreateParam).toHaveBeenCalledTimes(1);
  });

  it("fails closed and explains why when the role cannot create deals", async () => {
    await act(async () => root.render(<CreateDealDialog stages={[]} data={data} busy={false} setBusy={vi.fn()} create={vi.fn() as never} disabledReason="Недостаточно прав" />));
    expect(document.querySelector<HTMLElement>('[data-testid="deal-dialog"]')?.dataset.open).toBe("false");
    expect(clearCreateParam).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("Недостаточно прав");
  });

  it("fails closed until both project type and demand position exist", () => {
    expect(hasCreateDealReferenceData("", "position-generalist")).toBe(false);
    expect(hasCreateDealReferenceData("project-type-default", null)).toBe(false);
    expect(hasCreateDealReferenceData("project-type-default", "position-generalist")).toBe(true);
  });
});
