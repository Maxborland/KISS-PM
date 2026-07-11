-- Existing workspaces may contain duplicate emails. Keep the oldest value canonical and
-- choose a recoverable suffix for every later row, retrying when that suffix already exists.
LOCK TABLE "contacts" IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  duplicate_row record;
  candidate text;
  attempt integer;
BEGIN
  FOR duplicate_row IN
    SELECT "id", "tenant_id", "email"
    FROM (
      SELECT
        "id",
        "tenant_id",
        "email",
        row_number() OVER (
          PARTITION BY "tenant_id", "email"
          ORDER BY "created_at", "id"
        ) AS duplicate_rank
      FROM "contacts"
      WHERE "email" IS NOT NULL
    ) AS ranked
    WHERE duplicate_rank > 1
    ORDER BY "tenant_id", "email", duplicate_rank
  LOOP
    attempt := 0;
    LOOP
      candidate := duplicate_row.email || '.dup.' || duplicate_row.id
        || CASE WHEN attempt = 0 THEN '' ELSE '.' || attempt::text END;

      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM "contacts" AS existing
        WHERE existing."tenant_id" = duplicate_row.tenant_id
          AND existing."email" = candidate
          AND existing."id" <> duplicate_row.id
      );

      attempt := attempt + 1;
    END LOOP;

    UPDATE "contacts"
    SET "email" = candidate
    WHERE "tenant_id" = duplicate_row.tenant_id
      AND "id" = duplicate_row.id;
  END LOOP;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "contacts_tenant_id_email_uidx"
ON "contacts" USING btree ("tenant_id","email");
