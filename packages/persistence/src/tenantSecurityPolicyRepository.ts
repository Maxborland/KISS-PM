import { eq } from "drizzle-orm";

import {
  DEFAULT_TENANT_SECURITY_POLICY,
  type TenantId,
  type TenantSecurityPolicy
} from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import { tenantSecurityPolicies } from "./schema";

export type TenantSecurityPolicyRepository = {
  getTenantSecurityPolicy(tenantId: TenantId): Promise<TenantSecurityPolicy>;
  upsertTenantSecurityPolicy(
    tenantId: TenantId,
    policy: TenantSecurityPolicy
  ): Promise<TenantSecurityPolicy>;
};

function toView(row: typeof tenantSecurityPolicies.$inferSelect): TenantSecurityPolicy {
  return {
    twoFactorRequired: row.twoFactorRequired,
    sessionTimeoutHours: row.sessionTimeoutHours,
    ssoSamlEnabled: row.ssoSamlEnabled,
    domainAllowlist: row.domainAllowlist
  };
}

export function createTenantSecurityPolicyRepository(
  db: KissPmDatabase
): TenantSecurityPolicyRepository {
  return {
    async getTenantSecurityPolicy(tenantId) {
      const [row] = await db
        .select()
        .from(tenantSecurityPolicies)
        .where(eq(tenantSecurityPolicies.tenantId, tenantId))
        .limit(1);
      // ponytail: absent row → safe defaults; the card always renders.
      return row ? toView(row) : { ...DEFAULT_TENANT_SECURITY_POLICY };
    },

    async upsertTenantSecurityPolicy(tenantId, policy) {
      const now = new Date();
      const [row] = await db
        .insert(tenantSecurityPolicies)
        .values({
          tenantId,
          twoFactorRequired: policy.twoFactorRequired,
          sessionTimeoutHours: policy.sessionTimeoutHours,
          ssoSamlEnabled: policy.ssoSamlEnabled,
          domainAllowlist: policy.domainAllowlist,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: tenantSecurityPolicies.tenantId,
          set: {
            twoFactorRequired: policy.twoFactorRequired,
            sessionTimeoutHours: policy.sessionTimeoutHours,
            ssoSamlEnabled: policy.ssoSamlEnabled,
            domainAllowlist: policy.domainAllowlist,
            updatedAt: now
          }
        })
        .returning();
      if (!row) throw new Error("tenant_security_policy_upsert_failed");
      return toView(row);
    }
  };
}
