import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readText(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("deal title inline editor", () => {
  it("uses a dedicated H1 editor instead of the fact-row inline editor", () => {
    const view = readText("apps/web/src/OpportunityDetailView.tsx");
    const styles = readText("apps/web/src/crm.css");

    expect(view).toContain("function DealTitleInlineEditor");
    expect(view).toContain("className=\"deal-title-edit-input\"");
    expect(view).toContain("Название сделки должно быть не короче 3 символов.");
    expect(styles).toContain(".deal-title-edit-control");
    expect(styles).toContain("max-width: min(100%, 640px);");
  });
});
