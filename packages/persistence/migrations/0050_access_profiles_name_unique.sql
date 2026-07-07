CREATE UNIQUE INDEX IF NOT EXISTS "access_profiles_tenant_id_name_uidx"
ON "access_profiles" USING btree ("tenant_id","name");