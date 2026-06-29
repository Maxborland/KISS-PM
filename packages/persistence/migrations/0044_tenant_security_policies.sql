CREATE TABLE IF NOT EXISTS "tenant_security_policies" (
  "tenant_id" text NOT NULL,
  "two_factor_required" boolean NOT NULL DEFAULT false,
  "session_timeout_hours" integer NOT NULL DEFAULT 24,
  "sso_saml_enabled" boolean NOT NULL DEFAULT false,
  "domain_allowlist" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_at" timestamptz NOT NULL,
  CONSTRAINT "tenant_security_policies_pkey" PRIMARY KEY ("tenant_id"),
  CONSTRAINT "tenant_security_policies_timeout_chk" CHECK ("session_timeout_hours" >= 1),
  CONSTRAINT "tenant_security_policies_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade
);
