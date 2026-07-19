/**
 * Tenant-wide security policy (admin «Политики безопасности»).
 * Single row per tenant; absent row → safe defaults (see DEFAULT_TENANT_SECURITY_POLICY).
 */
export type TenantSecurityPolicy = {
  /**
   * RESERVED (Н5): 2FA is not implemented in the auth stack yet. The field is kept
   * for contract/storage compatibility; the admin UI shows roadmap text instead of
   * a control and never changes this value.
   */
  twoFactorRequired: boolean;
  sessionTimeoutHours: number;
  /**
   * RESERVED (Н5): SAML SSO is not implemented. Kept for contract/storage
   * compatibility; no UI control exists until the mechanism ships.
   */
  ssoSamlEnabled: boolean;
  domainAllowlist: string[];
};

export const DEFAULT_TENANT_SECURITY_POLICY: TenantSecurityPolicy = {
  twoFactorRequired: false,
  sessionTimeoutHours: 24,
  ssoSamlEnabled: false,
  domainAllowlist: []
};
