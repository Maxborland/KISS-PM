import { describe, expect, it } from "vitest";

import { parseSecurityPolicyBody } from "./workspaceConfigRoutes";

const valid = {
  securityPolicy: {
    twoFactorRequired: false,
    ssoSamlEnabled: false,
    sessionTimeoutHours: 24,
    domainAllowlist: ["company.com", "Corp.Example.RU"]
  }
};

describe("parseSecurityPolicyBody: домен-allowlist", () => {
  it("нормализует и принимает валидные домены", () => {
    const parsed = parseSecurityPolicyBody(valid);
    expect(parsed).toMatchObject({ ok: true, value: { domainAllowlist: ["company.com", "corp.example.ru"] } });
  });

  it("отклоняет строку, не являющуюся доменом (G6-10)", () => {
    const parsed = parseSecurityPolicyBody({
      securityPolicy: { ...valid.securityPolicy, domainAllowlist: ["это не домен!!"] }
    });
    expect(parsed).toEqual({ ok: false, error: "security_policy_domain_allowlist_invalid" });
  });

  it("отклоняет домен без точки и с ведущим дефисом", () => {
    for (const bad of ["localhost", "-bad.com", "bad-.com"]) {
      expect(parseSecurityPolicyBody({ securityPolicy: { ...valid.securityPolicy, domainAllowlist: [bad] } })).toEqual({
        ok: false,
        error: "security_policy_domain_allowlist_invalid"
      });
    }
  });
});
