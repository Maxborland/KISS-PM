ALTER TABLE "kpi_evaluations"
  ALTER COLUMN "calculated_value" TYPE double precision
  USING "calculated_value"::double precision;
