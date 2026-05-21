import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { normalizeTaskFormDate } from "./taskFormDates";

function readText(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("CRM date picker foundation", () => {
  it("does not use native browser date inputs in interactive web surfaces", () => {
    const sources = [
      "apps/web/src/DealFormModal.tsx",
      "apps/web/src/CrmActivityForms.tsx",
      "apps/web/src/CrmInlineEdit.tsx",
      "apps/web/src/TaskFormDialog.tsx"
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

  it("normalizes API datetime values before task edit submits date fields", () => {
    expect(normalizeTaskFormDate("2034-03-27T00:00:00.000Z")).toBe("2034-03-27");
    expect(normalizeTaskFormDate("2034-03-29")).toBe("2034-03-29");
    expect(normalizeTaskFormDate(null)).toBe("");
  });
});
