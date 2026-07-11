-- Keep the oldest duplicate name canonical and retry suffixes until one is genuinely unused.
LOCK TABLE "access_profiles" IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  duplicate_row record;
  candidate text;
  attempt integer;
BEGIN
  FOR duplicate_row IN
    SELECT "id", "tenant_id", "name"
    FROM (
      SELECT
        "id",
        "tenant_id",
        "name",
        row_number() OVER (
          PARTITION BY "tenant_id", "name"
          ORDER BY "created_at", "id"
        ) AS duplicate_rank
      FROM "access_profiles"
    ) AS ranked
    WHERE duplicate_rank > 1
    ORDER BY "tenant_id", "name", duplicate_rank
  LOOP
    attempt := 0;
    LOOP
      candidate := duplicate_row.name || ' (dup ' || duplicate_row.id
        || CASE WHEN attempt = 0 THEN '' ELSE '-' || attempt::text END || ')';

      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM "access_profiles" AS existing
        WHERE existing."tenant_id" = duplicate_row.tenant_id
          AND existing."name" = candidate
          AND existing."id" <> duplicate_row.id
      );

      attempt := attempt + 1;
    END LOOP;

    UPDATE "access_profiles"
    SET "name" = candidate
    WHERE "tenant_id" = duplicate_row.tenant_id
      AND "id" = duplicate_row.id;
  END LOOP;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "access_profiles_tenant_id_name_uidx"
ON "access_profiles" USING btree ("tenant_id","name");
