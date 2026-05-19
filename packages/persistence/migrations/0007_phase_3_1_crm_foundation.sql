CREATE TABLE "clients" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "clients_pkey" PRIMARY KEY("tenant_id","id"),
  CONSTRAINT "clients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "contacts" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "client_id" text NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "telegram" text,
  "role" text,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "contacts_pkey" PRIMARY KEY("tenant_id","id"),
  CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade,
  CONSTRAINT "contacts_client_fk" FOREIGN KEY ("tenant_id","client_id") REFERENCES "public"."clients"("tenant_id","id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "project_types" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "project_types_pkey" PRIMARY KEY("tenant_id","id"),
  CONSTRAINT "project_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "deal_stages" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "deal_stages_pkey" PRIMARY KEY("tenant_id","id"),
  CONSTRAINT "deal_stages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "clients_tenant_id_idx" ON "clients" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "clients_tenant_id_name_uidx" ON "clients" USING btree ("tenant_id","name");
--> statement-breakpoint
CREATE INDEX "contacts_tenant_id_idx" ON "contacts" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "contacts_tenant_client_id_idx" ON "contacts" USING btree ("tenant_id","client_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_tenant_id_client_id_id_uidx" ON "contacts" USING btree ("tenant_id","client_id","id");
--> statement-breakpoint
CREATE INDEX "project_types_tenant_id_idx" ON "project_types" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "project_types_tenant_id_name_uidx" ON "project_types" USING btree ("tenant_id","name");
--> statement-breakpoint
CREATE INDEX "deal_stages_tenant_id_idx" ON "deal_stages" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "deal_stages_tenant_id_sort_order_uidx" ON "deal_stages" USING btree ("tenant_id","sort_order");
--> statement-breakpoint
CREATE UNIQUE INDEX "deal_stages_tenant_id_name_uidx" ON "deal_stages" USING btree ("tenant_id","name");
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "client_id" text;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "primary_contact_id" text;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "project_type_id" text;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "stage_id" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "client_id" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "project_type_id" text;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_client_fk" FOREIGN KEY ("tenant_id","client_id") REFERENCES "public"."clients"("tenant_id","id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_primary_contact_fk" FOREIGN KEY ("tenant_id","primary_contact_id") REFERENCES "public"."contacts"("tenant_id","id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_project_type_fk" FOREIGN KEY ("tenant_id","project_type_id") REFERENCES "public"."project_types"("tenant_id","id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_stage_fk" FOREIGN KEY ("tenant_id","stage_id") REFERENCES "public"."deal_stages"("tenant_id","id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_fk" FOREIGN KEY ("tenant_id","client_id") REFERENCES "public"."clients"("tenant_id","id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_type_fk" FOREIGN KEY ("tenant_id","project_type_id") REFERENCES "public"."project_types"("tenant_id","id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "opportunities_stage_id_idx" ON "opportunities" USING btree ("tenant_id","stage_id");
