-- The old API allowed case-insensitive duplicates. Rename later rows before adding the indexes,
-- checking every generated suffix against the exact scope enforced by each index.
LOCK TABLE "planning_saved_views" IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  duplicate_row record;
  candidate text;
  attempt integer;
BEGIN
  FOR duplicate_row IN
    SELECT "id", "tenant_id", "project_id", "owner_user_id", "scope", "name"
    FROM (
      SELECT
        "id",
        "tenant_id",
        "project_id",
        "owner_user_id",
        "scope",
        "name",
        row_number() OVER (
          PARTITION BY
            "tenant_id",
            "project_id",
            CASE WHEN "scope" = 'user' THEN "owner_user_id" ELSE '' END,
            "scope",
            lower("name")
          ORDER BY "created_at", "id"
        ) AS duplicate_rank
      FROM "planning_saved_views"
    ) AS ranked
    WHERE duplicate_rank > 1
    ORDER BY "tenant_id", "project_id", "scope", "owner_user_id", lower("name"), duplicate_rank
  LOOP
    attempt := 0;
    LOOP
      candidate := duplicate_row.name || ' (dup ' || duplicate_row.id
        || CASE WHEN attempt = 0 THEN '' ELSE '-' || attempt::text END || ')';

      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM "planning_saved_views" AS existing
        WHERE existing."tenant_id" = duplicate_row.tenant_id
          AND existing."project_id" = duplicate_row.project_id
          AND existing."scope" = duplicate_row.scope
          AND (
            duplicate_row.scope = 'project'
            OR existing."owner_user_id" = duplicate_row.owner_user_id
          )
          AND lower(existing."name") = lower(candidate)
          AND existing."id" <> duplicate_row.id
      );

      attempt := attempt + 1;
    END LOOP;

    UPDATE "planning_saved_views"
    SET "name" = candidate
    WHERE "tenant_id" = duplicate_row.tenant_id
      AND "project_id" = duplicate_row.project_id
      AND "id" = duplicate_row.id;
  END LOOP;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS planning_saved_views_project_name_uidx
  ON planning_saved_views (tenant_id, project_id, lower(name))
  WHERE scope = 'project';

CREATE UNIQUE INDEX IF NOT EXISTS planning_saved_views_user_name_uidx
  ON planning_saved_views (tenant_id, project_id, owner_user_id, lower(name))
  WHERE scope = 'user';
