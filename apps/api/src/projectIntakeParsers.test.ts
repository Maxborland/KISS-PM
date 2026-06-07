import { describe, expect, it } from "vitest";

import {
  parseOpportunityFinalActionBody,
  parseOpportunityBody,
  parseOpportunityUpdateBody,
  parseProjectActivationBody
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

  it("parses optional owner user id on create and update", () => {
    const parsed = parseOpportunityBody(
      {
        ...validOpportunityBody,
        ownerUserId: "user-owner-1"
      },
      "tenant-alpha"
    );

    expect(parsed).toMatchObject({
      ok: true,
      value: {
        ownerUserId: "user-owner-1"
      }
    });

    const updated = parseOpportunityUpdateBody(
      {
        ...validOpportunityBody,
        ownerUserId: null
      },
      "tenant-alpha"
    );

    expect(updated).toMatchObject({
      ok: true,
      value: {
        ownerUserId: null
      }
    });
  });

  it("rejects malformed owner user id", () => {
    expect(
      parseOpportunityBody(
        {
          ...validOpportunityBody,
          ownerUserId: "not allowed"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_owner_user_id" });
  });

  it("parses initial CRM pipeline state on opportunity create", () => {
    const parsed = parseOpportunityBody(
      {
        ...validOpportunityBody,
        crmPipelineId: "pipeline-sales",
        crmPipelineStageId: "pipeline-stage-intake"
      },
      "tenant-alpha"
    );

    expect(parsed).toMatchObject({
      ok: true,
      value: {
        crmPipelineId: "pipeline-sales",
        crmPipelineStageId: "pipeline-stage-intake"
      }
    });
  });

  it("rejects partial CRM pipeline state on opportunity create", () => {
    expect(
      parseOpportunityBody(
        {
          ...validOpportunityBody,
          crmPipelineId: "pipeline-sales"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_crm_pipeline_state" });
  });

  it("omits CRM pipeline state fields from opportunity updates when absent", () => {
    const parsed = parseOpportunityUpdateBody(validOpportunityBody, "tenant-alpha");

    expect(parsed).toMatchObject({
      ok: true,
      value: {
        tenantId: "tenant-alpha"
      }
    });
    expect(parsed.ok && "crmPipelineId" in parsed.value).toBe(false);
    expect(parsed.ok && "crmPipelineStageId" in parsed.value).toBe(false);
  });

  it("rejects partial CRM pipeline clears on opportunity update", () => {
    expect(
      parseOpportunityUpdateBody(
        {
          ...validOpportunityBody,
          crmPipelineId: null
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_crm_pipeline_state" });

    expect(
      parseOpportunityUpdateBody(
        {
          ...validOpportunityBody,
          crmPipelineId: ""
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_crm_pipeline_state" });
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

  it("rejects control characters in opportunity metadata before persistence", () => {
    expect(
      parseOpportunityBody(
        {
          ...validOpportunityBody,
          title: "Внедрение\nскрытая строка"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_opportunity_title" });

    expect(
      parseOpportunityBody(
        {
          ...validOpportunityBody,
          clientName: "ООО Ромашка\u0000"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_client_name" });

    expect(
      parseOpportunityBody(
        {
          ...validOpportunityBody,
          description: "Описание\u0000"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_description" });

    expect(
      parseOpportunityFinalActionBody({
        status: "lost_rejected",
        reason: "Причина\u0000"
      })
    ).toEqual({ ok: false, error: "invalid_opportunity_final_reason" });

    expect(
      parseProjectActivationBody({
        acceptedRiskReason: "Риск\u0000"
      })
    ).toEqual({ ok: false, error: "invalid_risk_reason" });
  });

  it("rejects unsafe custom field keys and control-bearing custom field values", () => {
    expect(
      parseOpportunityBody(
        {
          ...validOpportunityBody,
          customFieldValues: {
            constructor: "pollution"
          }
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_custom_field_key" });

    expect(
      parseOpportunityBody(
        {
          ...validOpportunityBody,
          customFieldValues: {
            priority_model: "Высокий\nскрытая строка"
          }
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_custom_field_value" });
  });
});
