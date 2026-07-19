import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WithCommsEntityScope } from "./entity-scope";

vi.mock("@/communications/ui/comms-frame", () => ({
  CommsFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

vi.mock("@/communications/lib/use-comms", () => ({
  useCommsProjects: () => ({
    data: { projects: [] },
    status: "ready",
    error: null,
    reload: vi.fn()
  })
}));

describe("WithCommsEntityScope empty state", () => {
  it("renders a real CTA to CRM deals when the workspace has no projects", () => {
    const markup = renderToStaticMarkup(
      <WithCommsEntityScope activeTab="Чат">{() => <div>scoped-content</div>}</WithCommsEntityScope>
    );

    expect(markup).toContain("Пока нет проектов");
    expect(markup).toContain('href="/crm/deals"');
    expect(markup).toContain(">К сделкам</a>");
    expect(markup).not.toContain("scoped-content");
  });
});
