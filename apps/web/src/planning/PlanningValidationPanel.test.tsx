import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlanningValidationPanel } from "./PlanningValidationPanel";

describe("PlanningValidationPanel", () => {
  it("renders an explicit clean state when the engine reports no issues", () => {
    const html = renderToStaticMarkup(<PlanningValidationPanel issues={[]} />);

    expect(html).toContain("Проверки планирования");
    expect(html).toContain("Blocking validation issues нет");
  });

  it("renders severity, message and entity for validation issues", () => {
    const html = renderToStaticMarkup(
      <PlanningValidationPanel
        issues={[{
          code: "schedule_outside_project_bounds",
          severity: "warning",
          message: "Задача выходит за границы проекта",
          entity: { type: "task", id: "task-a" }
        }]}
      />
    );

    expect(html).toContain("Риск");
    expect(html).toContain("Задача выходит за границы проекта");
    expect(html).toContain("task: task-a");
  });
});
