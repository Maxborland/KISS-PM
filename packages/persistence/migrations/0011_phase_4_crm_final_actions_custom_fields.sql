ALTER TABLE "opportunities"
  ADD COLUMN IF NOT EXISTS "custom_field_values" jsonb NOT NULL DEFAULT '{}'::jsonb;
