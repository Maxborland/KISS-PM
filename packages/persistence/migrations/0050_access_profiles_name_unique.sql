-- Data cleanup BEFORE the unique index: an earlier API race (or manual data repair) could have
-- left two access profiles with the same name in one tenant. A bare CREATE UNIQUE INDEX would fail
-- there and block the upgrade. De-duplicate non-destructively: keep the oldest row's name untouched
-- (canonical), and make every later duplicate unique+recoverable by suffixing its own id.
WITH ranked AS (
  SELECT
    "id",
    "tenant_id",
    row_number() OVER (
      PARTITION BY "tenant_id", "name"
      ORDER BY "created_at", "id"
    ) AS rn
  FROM "access_profiles"
)
UPDATE "access_profiles" AS a
SET "name" = a."name" || ' (dup ' || a."id" || ')'
FROM ranked AS r
WHERE a."id" = r."id"
  AND a."tenant_id" = r."tenant_id"
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "access_profiles_tenant_id_name_uidx"
ON "access_profiles" USING btree ("tenant_id","name");
