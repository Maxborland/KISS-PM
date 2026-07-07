CREATE UNIQUE INDEX IF NOT EXISTS "contacts_tenant_id_email_uidx"
ON "contacts" USING btree ("tenant_id","email");
