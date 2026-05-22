import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createPlanningReadModelFixture } from "./planningReadModel.test-utils";
import { ResourceLoadSummary } from "./ResourceLoadSummary";

describe("ResourceLoadSummary", () => {
  it("aggregates day buckets and surfaces overloads without local scheduling logic", () => {
    const html = renderToStaticMarkup(
      <ResourceLoadSummary readModel={createPlanningReadModelFixture()} />
    );

    expect(html).toContain("Ресурсная загрузка");
    expect(html).toContain("Назначено");
    expect(html).toContain("10 ч");
    expect(html).toContain("Доступно");
    expect(html).toContain("8 ч");
    expect(html).toContain("Перегруз");
    expect(html).toContain("3 ч");
    expect(html).toContain("resource-alpha");
  });

  it("renders clean state when no overloads are present", () => {
    const html = renderToStaticMarkup(
      <ResourceLoadSummary
        readModel={createPlanningReadModelFixture({
          resourceLoad: {
            buckets: [],
            overloads: [],
            freeCapacityBuckets: []
          }
        })}
      />
    );

    expect(html).toContain("Перегрузов по текущему read model нет");
  });
});
