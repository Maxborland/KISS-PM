/**
 * Tenant-wide security policy (admin «Политики безопасности»).
 * Single row per tenant; absent row → safe defaults (see DEFAULT_TENANT_SECURITY_POLICY).
 */
export type TenantSecurityPolicy = {
  twoFactorRequired: boolean;
  sessionTimeoutHours: number;
  ssoSamlEnabled: boolean;
  domainAllowlist: string[];
};

export const DEFAULT_TENANT_SECURITY_POLICY: TenantSecurityPolicy = {
  twoFactorRequired: false,
  sessionTimeoutHours: 24,
  ssoSamlEnabled: false,
  domainAllowlist: []
};
