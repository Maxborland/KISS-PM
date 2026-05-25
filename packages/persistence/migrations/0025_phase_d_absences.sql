CREATE TABLE IF NOT EXISTS "resource_absences" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "user_id" text NOT NULL,
  "type" text NOT NULL,
  "date_from" text NOT NULL,
  "date_to" text NOT NULL,
  "status" text NOT NULL DEFAULT 'approved',
  "reason" text,
  "created_by" text,
  "approved_by" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "resource_absences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "resource_absences_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade,
  CONSTRAINT "resource_absences_user_fk"
    FOREIGN KEY ("tenant_id", "user_id") REFERENCES "public"."tenant_users"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "resource_absences_type_chk" CHECK (
    "type" in ('vacation', 'admin_leave', 'sick_leave', 'maternity_leave', 'truancy')
  ),
  CONSTRAINT "resource_absences_status_chk" CHECK ("status" in ('approved', 'pending', 'rejected')),
  CONSTRAINT "resource_absences_date_range_chk" CHECK ("date_to" >= "date_from")
);

CREATE INDEX IF NOT EXISTS "resource_absences_tenant_user_from_idx"
  ON "resource_absences" ("tenant_id", "user_id", "date_from");
