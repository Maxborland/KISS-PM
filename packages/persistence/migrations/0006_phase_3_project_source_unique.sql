CREATE UNIQUE INDEX "projects_tenant_source_opportunity_uidx" ON "projects" USING btree ("tenant_id","source_opportunity_id");
