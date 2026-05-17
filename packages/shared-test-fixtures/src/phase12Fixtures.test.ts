import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { getPhase12FixtureSeed, PHASE12_FIXTURE_TIMESTAMP } from "./phase12Fixtures";

describe("Phase 12 release demo fixtures", () => {
  it("describes a deterministic release demo tenant and template pack for E2E-110", () => {
    const seed = getPhase12FixtureSeed();

    expect(seed.generatedAt).toBe(PHASE12_FIXTURE_TIMESTAMP);
    expect(seed.e2eIds).toEqual(["E2E-110", "E2E-111", "E2E-112", "E2E-113", "E2E-114", "E2E-115"]);
    expect(seed.e2ePaths).toContain("e2e/tests/phase12/full-critical-journey.spec.ts");
    expect(seed.tenantA.tenantId).toBe("tenant-a");
    expect(seed.tenantA.roles.operatorAdmin.userId).toBe("tenant-admin-a");
    expect(seed.tenantA.roles.projectManager.userId).toBe("project-manager-a");
    expect(seed.tenantA.roles.resourceManager.userId).toBe("resource-manager-a");
    expect(seed.tenantA.roles.readonlyObserver.userId).toBe("readonly-observer-a");
    expect(seed.tenantA.templatePack.processTemplateKey).toBe("release_demo_control_loop");
    expect(seed.tenantA.templatePack.roleTemplates.map((role) => role.systemKey)).toEqual([
      "operator_admin",
      "tenant_admin",
      "project_manager",
      "resource_manager",
      "executive",
      "executor",
      "integration_admin",
      "readonly_observer"
    ]);
    expect(seed.tenantA.templatePack.controlSurfaceKeys).toEqual(
      expect.arrayContaining(["crm-intake", "resource-load-control", "portfolio-control", "operator-readiness"])
    );
    expect(seed.tenantA.criticalJourney).toMatchObject({
      opportunityId: "opp-release-demo-a",
      projectDraftId: "draft-release-demo-a",
      activeProjectId: "project-release-demo-a",
      closureProjectId: "project-p9-closure"
    });
    expect(seed.tenantA.mockExternalServices.mode).toBe("mocked");
    expect(JSON.stringify(seed)).not.toMatch(/secret|production credential|customer/i);
  });

  it("keeps Tenant B private ids available only for isolation checks", () => {
    const seed = getPhase12FixtureSeed();

    expect(seed.tenantB.tenantId).toBe("tenant-b");
    expect(seed.tenantB.privateEntities).toEqual(
      expect.arrayContaining(["opp-private-b", "project-private-b", "kpi-private-b", "mapping-private-b"])
    );
    expect(seed.tenantB.operatorDocsAudience).toBe("isolation-check-only");
  });

  it("links release onboarding and template-pack docs without live service instructions", () => {
    const seed = getPhase12FixtureSeed();
    const docs = seed.operatorDocs.map((docPath) => {
      const absolutePath = resolve(process.cwd(), docPath);
      expect(existsSync(absolutePath), `${docPath} should exist`).toBe(true);
      return readFileSync(absolutePath, "utf8");
    });

    expect(docs.join("\n")).toContain("P12 release demo tenant");
    expect(docs.join("\n")).toContain("E2E-110");
    expect(docs.join("\n")).toContain("mocked external services");
    expect(docs.join("\n")).not.toMatch(/real cloud credential|live Bitrix|live Jira|live Slack/i);
  });
});
