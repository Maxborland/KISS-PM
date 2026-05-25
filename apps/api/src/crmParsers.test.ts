import { describe, expect, it } from "vitest";

import {
  parseClientBody,
  parseContactBody,
  parseDealStageBody,
  parseProductBody,
  parseProjectTypeBody
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
