-- Data cleanup BEFORE the unique index: existing workspaces predate this constraint and may
-- already hold two contacts with the same non-null email in a tenant. A bare CREATE UNIQUE INDEX
-- would fail there and block the upgrade. De-duplicate non-destructively: keep the oldest row's
-- email untouched (canonical), and make every later duplicate unique+recoverable by suffixing its
-- own id. NULL emails are excluded (NULLs are distinct in a btree unique index, so they never clash).
WITH ranked AS (
  SELECT
    "id",
    "tenant_id",
    row_number() OVER (
      PARTITION BY "tenant_id", "email"
      ORDER BY "created_at", "id"
    ) AS rn
  FROM "contacts"
  WHERE "email" IS NOT NULL
)
UPDATE "contacts" AS c
SET "email" = c."email" || '.dup.' || c."id"
FROM ranked AS r
WHERE c."id" = r."id"
  AND c."tenant_id" = r."tenant_id"
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "contacts_tenant_id_email_uidx"
ON "contacts" USING btree ("tenant_id","email");
