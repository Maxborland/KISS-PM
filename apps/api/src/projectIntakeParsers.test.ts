import { describe, expect, it } from "vitest";

import { parseOpportunityBody } from "./projectIntakeParsers";

describe("project intake parsers", () => {
  const validOpportunityBody = {
    clientName: "ООО Ромашка",
    contactName: "Ирина Клиент",
    title: "Внедрение KISS PM",
    projectType: "implementation",
    plannedStart: "2026-06-01",
    plannedFinish: "2026-06-12",
    contractValue: 960_000,
    plannedHourlyRate: 6_000,
    probability: 80,
    demand: [
      { positionId: "position-engineer", requiredHours: 80 },
      { positionId: "position-project-manager", requiredHours: 80 }
    ]
  };

  it("calculates planned hours from contract value and planned hourly rate", () => {
    const parsed = parseOpportunityBody(validOpportunityBody, "tenant-alpha");

    expect(parsed).toMatchObject({
      ok: true,
      value: {
        tenantId: "tenant-alpha",
        plannedHours: 160
      }
    });
  });

  it("rejects calendar dates that JavaScript Date would otherwise roll over", () => {
    const parsed = parseOpportunityBody(
      {
        ...validOpportunityBody,
        plannedStart: "2026-02-31"
      },
      "tenant-alpha"
    );

    expect(parsed).toEqual({
      ok: false,
      error: "invalid_planned_dates"
    });
  });

  it("rejects duplicated demand positions", () => {
    const parsed = parseOpportunityBody(
      {
        ...validOpportunityBody,
        demand: [
          { positionId: "position-engineer", requiredHours: 40 },
          { positionId: "position-engineer", requiredHours: 40 }
        ]
      },
      "tenant-alpha"
    );

    expect(parsed).toEqual({
      ok: false,
      error: "duplicate_demand_position"
    });
  });

  it("rejects oversized Phase 3 input before it reaches PostgreSQL", () => {
    expect(
      parseOpportunityBody(
        {
          ...validOpportunityBody,
          title: "x".repeat(161)
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_opportunity_title" });

    expect(
      parseOpportunityBody(
        {
          ...validOpportunityBody,
          contractValue: 2_147_483_648
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_contract_value" });

    expect(
      parseOpportunityBody(
        {
          ...validOpportunityBody,
          demand: Array.from({ length: 13 }, (_, index) => ({
            positionId: `position-${index}`,
            requiredHours: 10
          }))
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_demand" });

    expect(
      parseOpportunityBody(
        {
          ...validOpportunityBody,
          plannedFinish: "2028-06-12"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_planned_dates" });
  });
});
