import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readText(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("CRM date picker foundation", () => {
  it("does not use native browser date inputs in interactive web surfaces", () => {
    const sources = [
      "apps/web/src/DealFormModal.tsx",
      "apps/web/src/CrmActivityForms.tsx",
      "apps/web/src/CrmInlineEdit.tsx",
      "apps/web/src/ProjectDetailView.tsx"
    ];

    for (const source of sources) {
      const text = readText(source);
      expect(text, source).not.toContain('type="date"');
      expect(text, source).toContain("DatePickerField");
    }
  });

  it("keeps the shadcn/Radix date picker primitives present", () => {
    expect(readText("apps/web/src/components/ui/popover.tsx")).toContain(
      "@radix-ui/react-popover"
    );
    expect(readText("apps/web/src/components/ui/calendar.tsx")).toContain(
      "react-day-picker"
    );
  });
});
