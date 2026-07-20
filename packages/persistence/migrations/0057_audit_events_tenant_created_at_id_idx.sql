-- Лента аудита читается keyset-пагинацией внутри тенанта:
--   where tenant_id = $1 [and (created_at, id) < ($cursor)]
--   order by created_at desc, id desc
--   limit <= 100
-- Индексов было только два (tenant_id, correlation_id), поэтому Postgres брал
-- tenant_id-скан и досортировывал результат. Сейчас это дёшево, но audit_events
-- append-only и без purge — композит снимает сортировку заранее (превентивно).
CREATE INDEX IF NOT EXISTS "audit_events_tenant_created_at_id_idx"
ON "audit_events" USING btree ("tenant_id","created_at" DESC,"id" DESC);
