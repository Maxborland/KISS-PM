ALTER TABLE "entity_attachments" DROP CONSTRAINT IF EXISTS "entity_attachments_entity_type_chk";
ALTER TABLE "entity_attachments"
  ADD CONSTRAINT "entity_attachments_entity_type_chk"
  CHECK ("entity_type" in ('opportunity', 'client', 'contact', 'product', 'project', 'task', 'communication_channel'));
