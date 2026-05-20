CREATE TABLE IF NOT EXISTS "products" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "name" text NOT NULL,
  "sku" text,
  "type" text NOT NULL,
  "unit" text NOT NULL,
  "price" integer NOT NULL,
  "description" text,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY("tenant_id","id"),
  CONSTRAINT "products_type_chk" CHECK ("products"."type" in ('service', 'goods')),
  CONSTRAINT "products_price_chk" CHECK ("products"."price" > 0)
);
--> statement-breakpoint
ALTER TABLE "products"
  ADD CONSTRAINT "products_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id")
  REFERENCES "public"."tenants"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_tenant_id_idx" ON "products" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_tenant_id_name_uidx" ON "products" USING btree ("tenant_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_tenant_id_sku_uidx" ON "products" USING btree ("tenant_id","sku");
