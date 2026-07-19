import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TopbarBreadcrumbs, type Crumb } from "./topbar-breadcrumbs";

vi.mock("@/views/lib/prototype-gate", () => ({ prototypeNotesEnabled: false }));

function render(items: Crumb[]) {
  const window = new Window();
  window.document.body.innerHTML = renderToStaticMarkup(<TopbarBreadcrumbs items={items} />);
  return window.document;
}

describe("TopbarBreadcrumbs navigation", () => {
  it("renders parent crumbs with href as real links and keeps the current crumb as text", () => {
    const document = render([
      { label: "Проекты", href: "/projects" },
      { label: "Внедрение CRM", current: true }
    ]);

    const link = document.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/projects");
    expect(link?.textContent).toBe("Проекты");

    // Текущая страница — не ссылка.
    const links = Array.from(document.querySelectorAll("a"));
    expect(links).toHaveLength(1);
    expect(document.body.textContent).toContain("Внедрение CRM");
  });

  it("keeps parents without href as plain text (no fake link)", () => {
    const document = render([
      { label: "Проекты", href: "/projects" },
      { label: "Внедрение CRM" },
      { label: "KPI", current: true }
    ]);

    const links = Array.from(document.querySelectorAll("a"));
    expect(links.map((a) => a.textContent)).toEqual(["Проекты"]);
    expect(document.body.textContent).toContain("Внедрение CRM");
  });
});
