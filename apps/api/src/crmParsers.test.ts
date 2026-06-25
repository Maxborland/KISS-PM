import { describe, expect, it } from "vitest";

import {
  parseClientBody,
  parseContactBody,
  parseDealStageBody,
  parsePipelineBody,
  parseProductBody,
  parseProjectTypeBody,
  parseStageTransitionBody
} from "./crmParsers";

describe("crm parsers", () => {
  it("normalizes product input for the current tenant", () => {
    expect(
      parseProductBody(
        {
          id: "product-implementation",
          name: " Внедрение KISS PM ",
          sku: " KISS-IMPL ",
          type: "service",
          unit: "час",
          price: 6000,
          description: "Проектная услуга внедрения"
        },
        "tenant-alpha"
      )
    ).toEqual({
      ok: true,
      value: {
        id: "product-implementation",
        tenantId: "tenant-alpha",
        name: "Внедрение KISS PM",
        sku: "KISS-IMPL",
        type: "service",
        unit: "час",
        price: 6000,
        description: "Проектная услуга внедрения",
        status: "active"
      }
    });
  });

  it("rejects invalid product input before API mutation", () => {
    expect(
      parseProductBody(
        {
          id: "product-invalid",
          name: "",
          type: "unknown",
          unit: "",
          price: 0
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_product_name" });

    expect(
      parseProductBody(
        {
          id: "product-invalid",
          name: "Услуга",
          type: "unknown",
          unit: "час",
          price: 1000
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_product_type" });
  });

  it("rejects control characters in CRM display fields before persistence", () => {
    expect(
      parseClientBody(
        {
          id: "client-acme",
          name: "ACME\nInjected",
          status: "active"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_client_name" });

    expect(
      parseContactBody(
        {
          id: "contact-main",
          clientId: "client-acme",
          name: "Иван",
          email: "ivan@example.com",
          phone: "+7\u0000123",
          status: "active"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_contact_phone" });

    expect(
      parseProductBody(
        {
          id: "product-implementation",
          name: "Внедрение",
          sku: "KISS\nIMPL",
          type: "service",
          unit: "час",
          price: 6000
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_product_sku" });

    expect(
      parseProjectTypeBody(
        {
          id: "project-type-implementation",
          name: "Внедрение",
          description: "Безопасное описание\u0000"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_description" });

    expect(
      parseDealStageBody(
        {
          id: "deal-stage-new",
          name: "Новая\tстадия",
          sortOrder: 1,
          status: "active"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_deal_stage_name" });
  });

  it("normalizes contact email casing while preserving safe CRM text", () => {
    expect(
      parseContactBody(
        {
          id: "contact-main",
          clientId: "client-acme",
          name: " Иван ",
          email: " IVAN@EXAMPLE.COM ",
          phone: "+7 900 000-00-00",
          role: "Заказчик",
          status: "active"
        },
        "tenant-alpha"
      )
    ).toEqual({
      ok: true,
      value: {
        id: "contact-main",
        tenantId: "tenant-alpha",
        clientId: "client-acme",
        name: "Иван",
        email: "ivan@example.com",
        phone: "+7 900 000-00-00",
        telegram: null,
        role: "Заказчик",
        status: "active"
      }
    });
  });
});

describe("pipeline parser", () => {
  it("normalizes pipeline input with defaults for status and isDefault", () => {
    expect(
      parsePipelineBody(
        {
          id: "pipeline-sales",
          name: " Продажи ",
          description: " Основная воронка ",
          sortOrder: 10
        },
        "tenant-alpha"
      )
    ).toEqual({
      ok: true,
      value: {
        id: "pipeline-sales",
        tenantId: "tenant-alpha",
        name: "Продажи",
        description: "Основная воронка",
        isDefault: false,
        sortOrder: 10,
        status: "active"
      }
    });
  });

  it("rejects pipeline with missing name and bad sort order", () => {
    expect(
      parsePipelineBody({ id: "pipeline-sales", sortOrder: 5 }, "tenant-alpha")
    ).toEqual({ ok: false, error: "invalid_pipeline_name" });

    expect(
      parsePipelineBody(
        { id: "pipeline-sales", name: "Продажи", sortOrder: 0 },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_pipeline_sort_order" });
  });

  it("rejects non-boolean isDefault", () => {
    expect(
      parsePipelineBody(
        { id: "pipeline-sales", name: "Продажи", sortOrder: 10, isDefault: "yes" },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_body" });
  });
});

describe("stage transition parser", () => {
  it("normalizes transition input with the route pipeline id", () => {
    expect(
      parseStageTransitionBody(
        {
          id: "stage-transition-qualify",
          fromStageId: "deal-stage-lead",
          toStageId: "deal-stage-qualified",
          requireFeasibilityOk: true,
          minProbability: 40,
          guardNote: "Только после квалификации"
        },
        "tenant-alpha",
        "pipeline-sales"
      )
    ).toEqual({
      ok: true,
      value: {
        id: "stage-transition-qualify",
        tenantId: "tenant-alpha",
        pipelineId: "pipeline-sales",
        fromStageId: "deal-stage-lead",
        toStageId: "deal-stage-qualified",
        requireFeasibilityOk: true,
        minProbability: 40,
        guardNote: "Только после квалификации"
      }
    });
  });

  it("defaults optional fields and accepts omitted minProbability", () => {
    expect(
      parseStageTransitionBody(
        {
          id: "stage-transition-plain",
          fromStageId: "deal-stage-lead",
          toStageId: "deal-stage-qualified"
        },
        "tenant-alpha",
        "pipeline-sales"
      )
    ).toEqual({
      ok: true,
      value: {
        id: "stage-transition-plain",
        tenantId: "tenant-alpha",
        pipelineId: "pipeline-sales",
        fromStageId: "deal-stage-lead",
        toStageId: "deal-stage-qualified",
        requireFeasibilityOk: false,
        minProbability: null,
        guardNote: null
      }
    });
  });

  it("rejects identical from/to stages and out-of-range probability", () => {
    expect(
      parseStageTransitionBody(
        { fromStageId: "deal-stage-lead", toStageId: "deal-stage-lead" },
        "tenant-alpha",
        "pipeline-sales"
      )
    ).toEqual({ ok: false, error: "invalid_transition_stages" });

    expect(
      parseStageTransitionBody(
        {
          fromStageId: "deal-stage-lead",
          toStageId: "deal-stage-qualified",
          minProbability: 140
        },
        "tenant-alpha",
        "pipeline-sales"
      )
    ).toEqual({ ok: false, error: "invalid_min_probability" });

    expect(
      parseStageTransitionBody(
        { fromStageId: "BAD", toStageId: "deal-stage-qualified" },
        "tenant-alpha",
        "pipeline-sales"
      )
    ).toEqual({ ok: false, error: "invalid_deal_stage_id" });
  });
});
