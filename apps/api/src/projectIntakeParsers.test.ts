import { describe, expect, it } from "vitest";

import {
  parseOpportunityFinalActionBody,
  parseOpportunityBody,
  parseOpportunityUpdateBody
} from "./projectIntakeParsers";

describe("project intake parsers", () => {
  const validOpportunityBody = {
    clientId: "client-romashka",
    primaryContactId: "contact-irina",
    projectTypeId: "project-type-implementation",
    stageId: "deal-stage-new",
    title: "Внедрение KISS PM",
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

  it("parses opportunity updates and recalculates required hours from value and hourly norm", () => {
    const parsed = parseOpportunityUpdateBody(
      {
        ...validOpportunityBody,
        title: "Внедрение KISS PM обновлено",
        contractValue: 1_200_000,
        plannedHourlyRate: 6_000,
        demand: [{ positionId: "position-engineer", requiredHours: 200 }]
      },
      "tenant-alpha"
    );

    expect(parsed).toMatchObject({
      ok: true,
      value: {
        tenantId: "tenant-alpha",
        title: "Внедрение KISS PM обновлено",
        contractValue: 1_200_000,
        plannedHourlyRate: 6_000,
        plannedHours: 200,
        demand: [{ positionId: "position-engineer", requiredHours: 200 }]
      }
    });
  });

  it("parses runtime custom field values on create and update", () => {
    const parsed = parseOpportunityBody(
      {
        ...validOpportunityBody,
        customFieldValues: {
          priority_model: "Высокий",
          expected_margin: "31"
        }
      },
      "tenant-alpha"
    );

    expect(parsed).toMatchObject({
      ok: true,
      value: {
        customFieldValues: {
          priority_model: "Высокий",
          expected_margin: "31"
        }
      }
    });

    const updated = parseOpportunityUpdateBody(
      {
        ...validOpportunityBody,
        customFieldValues: {
          priority_model: "Средний"
        }
      },
      "tenant-alpha"
    );

    expect(updated).toMatchObject({
      ok: true,
      value: {
        customFieldValues: {
          priority_model: "Средний"
        }
      }
    });
  });

  it("parses governed final deal actions with a decision reason", () => {
    expect(
      parseOpportunityFinalActionBody({
        status: "lost_rejected",
        reason: "Клиент заморозил бюджет"
      })
    ).toEqual({
      ok: true,
      value: {
        status: "lost_rejected",
        reason: "Клиент заморозил бюджет"
      }
    });

    expect(
      parseOpportunityFinalActionBody({
        status: "won_closed",
        reason: ""
      })
    ).toEqual({ ok: false, error: "invalid_opportunity_final_reason" });
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
