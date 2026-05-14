import { describe, expect, it } from "vitest";

import { evaluateOpportunityReadiness } from "./index";

describe("opportunity readiness checks", () => {
  it("marks a complete qualified opportunity intake as ready for feasibility", () => {
    const readiness = evaluateOpportunityReadiness({
      tenantId: "tenant-a",
      opportunityId: "opportunity-ready",
      accountId: "account-acme",
      contactIds: ["contact-acme-sponsor"],
      plannedStartDate: "2026-07-01",
      desiredFinishDate: "2026-12-15",
      categoryKey: "implementation",
      typologyKey: "fixed_scope",
      scopeHints: [{ key: "modules_count", label: "Модулей", value: 4 }],
      templateMatch: {
        templateId: "template-implementation",
        confidence: 0.82
      }
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.blockers).toEqual([]);
    expect(readiness.nextAction).toBe("run_feasibility");
    expect(readiness.trace).toContain("readiness:ready");
  });

  it("returns deterministic blockers and collect-missing-data action for incomplete intake", () => {
    const readiness = evaluateOpportunityReadiness({
      tenantId: "tenant-a",
      opportunityId: "opportunity-incomplete",
      contactIds: [],
      plannedStartDate: "",
      desiredFinishDate: undefined,
      categoryKey: "",
      typologyKey: "   ",
      scopeHints: [],
      templateMatch: undefined
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.nextAction).toBe("collect_missing_data");
    expect(readiness.blockers.map((blocker) => blocker.code)).toEqual([
      "account_or_contact_missing",
      "planned_dates_missing",
      "category_missing",
      "typology_missing",
      "scope_hints_missing",
      "template_match_missing"
    ]);
    expect(readiness.blockers[0]).toMatchObject({
      severity: "blocking",
      message: "Укажите клиента или контакт либо явно отметьте, что они пока неизвестны."
    });
    expect(readiness.blockers.every((blocker) => blocker.message.length > 0)).toBe(true);
  });

  it("allows intentionally unknown account and contact while preserving other blockers", () => {
    const readiness = evaluateOpportunityReadiness({
      tenantId: "tenant-a",
      opportunityId: "opportunity-unknown-contact",
      accountContactIntent: "intentionally_unknown",
      plannedStartDate: "2026-07-01",
      desiredFinishDate: "2026-12-15",
      categoryKey: "implementation",
      typologyKey: "fixed_scope",
      scopeHints: [{ key: "modules_count", label: "Модулей", value: 4 }],
      templateMatch: undefined
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.map((blocker) => blocker.code)).not.toContain("account_or_contact_missing");
    expect(readiness.blockers.map((blocker) => blocker.code)).toEqual(["template_match_missing"]);
    expect(readiness.nextAction).toBe("select_process_template");
  });

  it("routes low-confidence template matches to confidence improvement before feasibility", () => {
    const readiness = evaluateOpportunityReadiness({
      tenantId: "tenant-a",
      opportunityId: "opportunity-low-confidence",
      accountId: "account-acme",
      plannedStartDate: "2026-07-01",
      desiredFinishDate: "2026-12-15",
      categoryKey: "implementation",
      typologyKey: "fixed_scope",
      scopeHints: [{ key: "modules_count", label: "Модулей", value: 4 }],
      templateMatch: {
        templateId: "template-implementation",
        confidence: 0.39
      },
      minimumTemplateConfidence: 0.6
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.nextAction).toBe("improve_confidence");
    expect(readiness.blockers).toEqual([
      {
        code: "low_confidence",
        severity: "blocking",
        message: "Уточните данные возможности: уверенность подбора шаблона ниже допустимого порога.",
        fieldRefs: ["templateMatch.confidence"]
      }
    ]);
  });

  it("treats an empty template id as a missing template match blocker", () => {
    const readiness = evaluateOpportunityReadiness({
      tenantId: "tenant-a",
      opportunityId: "opportunity-empty-template",
      accountId: "account-acme",
      plannedStartDate: "2026-07-01",
      desiredFinishDate: "2026-12-15",
      categoryKey: "implementation",
      typologyKey: "fixed_scope",
      scopeHints: [{ key: "modules_count", label: "Модулей", value: 4 }],
      templateMatch: {
        templateId: "   ",
        confidence: 0.9
      }
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.nextAction).toBe("select_process_template");
    expect(readiness.blockers.map((blocker) => blocker.code)).toEqual(["template_match_missing"]);
  });

  it("requires category and typology to be stable system keys, not tenant labels", () => {
    const readiness = evaluateOpportunityReadiness({
      tenantId: "tenant-a",
      opportunityId: "opportunity-label-keys",
      accountId: "account-acme",
      plannedStartDate: "2026-07-01",
      desiredFinishDate: "2026-12-15",
      categoryKey: "Внедрение",
      typologyKey: "Фиксированный объем",
      scopeHints: [{ key: "modules_count", label: "Модулей", value: 4 }],
      templateMatch: {
        templateId: "template-implementation",
        confidence: 0.9
      }
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.nextAction).toBe("collect_missing_data");
    expect(readiness.blockers.map((blocker) => blocker.code)).toEqual(["category_missing", "typology_missing"]);
  });
});
