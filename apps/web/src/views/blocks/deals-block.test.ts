import { describe, expect, it } from "vitest";

import { getFixtureBundle } from "@/lib/mock-data/fixture-bundle";
import { buildFunnelDeals, buildFunnelStages } from "@/lib/mock-data/scenario-presenters";
import { resolveDealsBlockSources } from "@/views/blocks/deals-block";

describe("DealsBlock data sources", () => {
  it("uses Storybook scenario fixtures by default", () => {
    const fixtures = getFixtureBundle("default");

    expect(resolveDealsBlockSources(fixtures)).toEqual({
      stages: buildFunnelStages(fixtures),
      deals: buildFunnelDeals(fixtures.opportunities)
    });
  });

  it("uses live runtime stages and deals when provided", () => {
    const fixtures = getFixtureBundle("default");
    const liveStages = [{ id: "runtime-stage", title: "Согласование" }];
    const liveDeals = [
      { ...buildFunnelDeals(fixtures.opportunities)[0]!, id: "deal-live", stage: "runtime-stage" }
    ];

    expect(resolveDealsBlockSources(fixtures, { initialDeals: liveDeals, stages: liveStages })).toEqual({
      stages: liveStages,
      deals: liveDeals
    });
  });
});
