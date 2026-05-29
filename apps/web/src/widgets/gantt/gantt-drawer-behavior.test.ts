import { describe, expect, it } from "vitest";

import { planningIssueLabel } from "./gantt-planning-issues";

describe("gantt visible Russian copy", () => {
  it("planning issue labels are Russian", () => {
    expect(planningIssueLabel("backend_pending")).toBe(
      "Проверка планирования недоступна без серверного движка"
    );
    expect(planningIssueLabel("resource_overload")).toBe("Перегруз ресурса");
    expect(planningIssueLabel("invalid_date")).toBe("Некорректное значение");
    expect(planningIssueLabel("dependency_conflict")).toBe("Ошибка планирования");
  });
});
