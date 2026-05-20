import { describe, expect, it } from "vitest";

import { parseProductBody } from "./crmParsers";

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
});
