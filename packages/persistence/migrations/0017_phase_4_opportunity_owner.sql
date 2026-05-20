ALTER TABLE "opportunities"
  ADD COLUMN IF NOT EXISTS "owner_user_id" text;
--> statement-breakpoint
UPDATE "opportunities"
SET "owner_user_id" = COALESCE(
  "owner_user_id",
  (
    SELECT "id"
    FROM "tenant_users"
    WHERE "tenant_users"."tenant_id" = "opportunities"."tenant_id"
      AND "tenant_users"."status" = 'active'
    ORDER BY "tenant_users"."id"
    LIMIT 1
  )
)
WHERE "owner_user_id" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_owner_user_id_idx"
  ON "opportunities" USING btree ("tenant_id", "owner_user_id");
