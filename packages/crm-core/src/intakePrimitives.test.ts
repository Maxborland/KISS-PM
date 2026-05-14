import { describe, expect, it } from "vitest";

import {
  createAccount,
  createContact,
  createOpportunity,
  createOpportunityStage,
  CrmCoreModelError
} from "./index";

describe("CRM intake domain primitives", () => {
  it("creates tenant-owned account, contact, stage, and opportunity primitives without external CRM coupling", () => {
    const account = createAccount({
      id: "account-acme",
      tenantId: "tenant-a",
      displayName: "АО Проектный клиент",
      legalName: "АО Проектный клиент",
      createdAt: "2026-05-14T00:00:00.000Z"
    });
    const contact = createContact({
      id: "contact-acme-sponsor",
      tenantId: "tenant-a",
      accountId: account.id,
      displayName: "Анна Заказчик",
      email: "anna@example.test",
      phone: "+79990000000"
    });
    const stage = createOpportunityStage({
      id: "stage-analysis",
      tenantId: "tenant-a",
      systemKey: "analysis",
      label: "Анализ",
      sortOrder: 20,
      active: true
    });
    const opportunity = createOpportunity({
      id: "opportunity-acme-portal",
      tenantId: "tenant-a",
      title: "Портал управления проектами",
      stage,
      account,
      contacts: [contact],
      plannedStartDate: "2026-07-01",
      desiredFinishDate: "2026-12-15",
      expectedValue: {
        amount: 12_500_000,
        currency: "RUB"
      },
      probability: 0.65,
      categoryKey: "implementation",
      typologyKey: "fixed_scope",
      scopeHints: [
        {
          key: "integrations_count",
          label: "Количество интеграций",
          value: 3
        }
      ],
      customFieldRefs: [
        {
          definitionId: "cf-opportunity-priority",
          key: "priority"
        }
      ],
      createdAt: "2026-05-14T00:00:00.000Z"
    });

    expect(account.tenantId).toBe("tenant-a");
    expect(contact.tenantId).toBe("tenant-a");
    expect(stage.tenantId).toBe("tenant-a");
    expect(opportunity).toMatchObject({
      id: "opportunity-acme-portal",
      tenantId: "tenant-a",
      stageSystemKey: "analysis",
      accountId: "account-acme",
      contactIds: ["contact-acme-sponsor"],
      plannedStartDate: "2026-07-01",
      desiredFinishDate: "2026-12-15",
      expectedValue: {
        amount: 12_500_000,
        currency: "RUB"
      },
      probability: 0.65,
      categoryKey: "implementation",
      typologyKey: "fixed_scope",
      source: {
        type: "manual"
      }
    });
    expect(JSON.stringify(opportunity)).not.toContain("bitrix");
    expect(JSON.stringify(opportunity)).not.toContain("amocrm");
  });

  it("rejects opportunity references from another tenant without leaking referenced details", () => {
    const stage = createOpportunityStage({
      id: "stage-analysis",
      tenantId: "tenant-a",
      systemKey: "analysis",
      label: "Анализ",
      sortOrder: 20,
      active: true
    });
    const accountFromTenantB = createAccount({
      id: "account-tenant-b-private",
      tenantId: "tenant-b",
      displayName: "Private Tenant B account",
      createdAt: "2026-05-14T00:00:00.000Z"
    });

    expect(() =>
      createOpportunity({
        id: "opportunity-broken",
        tenantId: "tenant-a",
        title: "Broken cross-tenant opportunity",
        stage,
        account: accountFromTenantB,
        contacts: [],
        plannedStartDate: "2026-07-01",
        desiredFinishDate: "2026-12-15",
        expectedValue: {
          amount: 1,
          currency: "RUB"
        },
        probability: 0.5,
        categoryKey: "implementation",
        typologyKey: "fixed_scope",
        createdAt: "2026-05-14T00:00:00.000Z"
      })
    ).toThrow(CrmCoreModelError);

    try {
      createOpportunity({
        id: "opportunity-broken",
        tenantId: "tenant-a",
        title: "Broken cross-tenant opportunity",
        stage,
        account: accountFromTenantB,
        contacts: [],
        plannedStartDate: "2026-07-01",
        desiredFinishDate: "2026-12-15",
        expectedValue: {
          amount: 1,
          currency: "RUB"
        },
        probability: 0.5,
        categoryKey: "implementation",
        typologyKey: "fixed_scope",
        createdAt: "2026-05-14T00:00:00.000Z"
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CrmCoreModelError);
      expect((error as CrmCoreModelError).code).toBe("tenant_mismatch");
      expect((error as CrmCoreModelError).message).not.toContain("Private Tenant B account");
    }
  });

  it("validates stable system keys, ISO dates, probability, and date windows", () => {
    expect(() =>
      createOpportunityStage({
        id: "stage-bad",
        tenantId: "tenant-a",
        systemKey: "ГЗМПК",
        label: "ГЗМПК",
        sortOrder: 1,
        active: true
      })
    ).toThrow("opportunityStage.systemKey must be a stable system key");

    const stage = createOpportunityStage({
      id: "stage-analysis",
      tenantId: "tenant-a",
      systemKey: "analysis",
      label: "Анализ",
      sortOrder: 20,
      active: true
    });

    expect(() =>
      createOpportunity({
        id: "opportunity-bad-date",
        tenantId: "tenant-a",
        title: "Bad date",
        stage,
        contacts: [],
        plannedStartDate: "2026-12-15",
        desiredFinishDate: "2026-07-01",
        expectedValue: {
          amount: 10,
          currency: "RUB"
        },
        probability: 1.1,
        categoryKey: "implementation",
        typologyKey: "fixed_scope",
        createdAt: "2026-05-14T00:00:00.000Z"
      })
    ).toThrow("opportunity.probability must be between 0 and 1");

    expect(() =>
      createOpportunity({
        id: "opportunity-bad-window",
        tenantId: "tenant-a",
        title: "Bad window",
        stage,
        contacts: [],
        plannedStartDate: "2026-12-15",
        desiredFinishDate: "2026-07-01",
        expectedValue: {
          amount: 10,
          currency: "RUB"
        },
        probability: 0.5,
        categoryKey: "implementation",
        typologyKey: "fixed_scope",
        createdAt: "2026-05-14T00:00:00.000Z"
      })
    ).toThrow("opportunity.desiredFinishDate must be on or after plannedStartDate");
  });

  it("returns defensive copies for scope hints and custom field metadata", () => {
    const stage = createOpportunityStage({
      id: "stage-analysis",
      tenantId: "tenant-a",
      systemKey: "analysis",
      label: "Анализ",
      sortOrder: 20,
      active: true
    });
    const scopeHints = [{ key: "modules_count", label: "Модулей", value: 4 }];
    const customFieldRefs = [{ definitionId: "cf-risk", key: "risk_level" }];
    const opportunity = createOpportunity({
      id: "opportunity-metadata",
      tenantId: "tenant-a",
      title: "Metadata opportunity",
      stage,
      contacts: [],
      plannedStartDate: "2026-07-01",
      desiredFinishDate: "2026-12-15",
      expectedValue: {
        amount: 10,
        currency: "RUB"
      },
      probability: 0.5,
      categoryKey: "implementation",
      typologyKey: "fixed_scope",
      scopeHints,
      customFieldRefs,
      createdAt: "2026-05-14T00:00:00.000Z"
    });

    scopeHints[0]!.value = 999;
    customFieldRefs[0]!.key = "changed";

    expect(opportunity.scopeHints).toEqual([{ key: "modules_count", label: "Модулей", value: 4 }]);
    expect(opportunity.customFieldRefs).toEqual([{ definitionId: "cf-risk", key: "risk_level" }]);
  });

  it("rejects malformed runtime metadata and stage refs without TypeError crashes", () => {
    const stage = createOpportunityStage({
      id: "stage-analysis",
      tenantId: "tenant-a",
      systemKey: "analysis",
      label: "Анализ",
      sortOrder: 20,
      active: true
    });

    expect(() =>
      createOpportunity({
        id: "opportunity-missing-contacts",
        tenantId: "tenant-a",
        title: "Missing contacts",
        stage,
        contacts: undefined as unknown as [],
        plannedStartDate: "2026-07-01",
        desiredFinishDate: "2026-12-15",
        expectedValue: {
          amount: 10,
          currency: "RUB"
        },
        probability: 0.5,
        categoryKey: "implementation",
        typologyKey: "fixed_scope",
        createdAt: "2026-05-14T00:00:00.000Z"
      })
    ).toThrow("opportunity.contacts must be an array");

    expect(() =>
      createOpportunity({
        id: "opportunity-invalid-stage-ref",
        tenantId: "tenant-a",
        title: "Invalid stage ref",
        stage: { ...stage, systemKey: "ГЗМПК" },
        contacts: [],
        plannedStartDate: "2026-07-01",
        desiredFinishDate: "2026-12-15",
        expectedValue: {
          amount: 10,
          currency: "RUB"
        },
        probability: 0.5,
        categoryKey: "implementation",
        typologyKey: "fixed_scope",
        createdAt: "2026-05-14T00:00:00.000Z"
      })
    ).toThrow("opportunity.stage.systemKey must be a stable system key");

    expect(() =>
      createOpportunity({
        id: "opportunity-invalid-stage-active",
        tenantId: "tenant-a",
        title: "Invalid stage active",
        stage: { ...stage, active: "yes" as unknown as boolean },
        contacts: [],
        plannedStartDate: "2026-07-01",
        desiredFinishDate: "2026-12-15",
        expectedValue: {
          amount: 10,
          currency: "RUB"
        },
        probability: 0.5,
        categoryKey: "implementation",
        typologyKey: "fixed_scope",
        createdAt: "2026-05-14T00:00:00.000Z"
      })
    ).toThrow("opportunity.stage.active must be a boolean");

    expect(() =>
      createOpportunity({
        id: "opportunity-missing-stage",
        tenantId: "tenant-a",
        title: "Missing stage",
        stage: null as unknown as typeof stage,
        contacts: [],
        plannedStartDate: "2026-07-01",
        desiredFinishDate: "2026-12-15",
        expectedValue: {
          amount: 10,
          currency: "RUB"
        },
        probability: 0.5,
        categoryKey: "implementation",
        typologyKey: "fixed_scope",
        createdAt: "2026-05-14T00:00:00.000Z"
      })
    ).toThrow("opportunity.stage must be an object");

    expect(() =>
      createOpportunity({
        id: "opportunity-bad-scope-hints",
        tenantId: "tenant-a",
        title: "Bad scope hints",
        stage,
        contacts: [],
        plannedStartDate: "2026-07-01",
        desiredFinishDate: "2026-12-15",
        expectedValue: {
          amount: 10,
          currency: "RUB"
        },
        probability: 0.5,
        categoryKey: "implementation",
        typologyKey: "fixed_scope",
        scopeHints: {} as unknown as [],
        createdAt: "2026-05-14T00:00:00.000Z"
      })
    ).toThrow("opportunity.scopeHints must be an array");

    expect(() =>
      createOpportunity({
        id: "opportunity-bad-custom-fields",
        tenantId: "tenant-a",
        title: "Bad custom fields",
        stage,
        contacts: [],
        plannedStartDate: "2026-07-01",
        desiredFinishDate: "2026-12-15",
        expectedValue: {
          amount: 10,
          currency: "RUB"
        },
        probability: 0.5,
        categoryKey: "implementation",
        typologyKey: "fixed_scope",
        customFieldRefs: [null] as unknown as [],
        createdAt: "2026-05-14T00:00:00.000Z"
      })
    ).toThrow("opportunity.customFieldRef must be an object");
  });
});
