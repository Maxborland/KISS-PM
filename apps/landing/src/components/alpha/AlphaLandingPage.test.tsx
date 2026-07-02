import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import AlphaLandingPage from "./AlphaLandingPage";
import { AlphaForm } from "./AlphaForm";
import { DiffReviewMock } from "./DiffReviewMock";
import AgentDiffHeroDemo from "../AgentDiffHeroDemo";

describe("AlphaLandingPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  function render(element: ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(element);
    });
  }

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the closed alpha hero with project diff proof", () => {
    render(<AlphaLandingPage />);

    const text = container.textContent ?? "";
    expect(text).toContain("Управляйте проектами через агента. Применяйте только одобренное.");
    expect(text).toContain("proposed project diff");
    expect(text).toContain("Применить выбранное");
    expect(text).toContain("audit trail preview");
  });

  it("renders marketing diff-review states without circular progress widgets", () => {
    render(<DiffReviewMock state="permission" />);

    const text = container.textContent ?? "";
    expect(text).toContain("Требуется подтверждение роли");
    expect(text).toContain("H-105");
    expect(container.querySelector("svg circle")).toBeNull();
  });

  it("renders alpha form success as an honest local demo state", () => {
    render(<AlphaForm mode="success" />);

    const text = container.textContent ?? "";
    expect(text).toContain("Мы получили заявку");
    expect(text).toContain("форма не отправляет данные на сервер");
  });

  it("renders the interactive hero agent demo", () => {
    render(<AgentDiffHeroDemo />);

    const text = container.textContent ?? "";
    expect(text).toContain("project agent");
    expect(text).toContain("proposed project diff");
    expect(text).toContain("OK, применить выбранное");
  });
});
