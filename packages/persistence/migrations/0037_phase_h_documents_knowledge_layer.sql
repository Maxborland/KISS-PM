CREATE TABLE "knowledge_documents" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "project_id" text NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "document_type" text NOT NULL,
  "status" text NOT NULL,
  "current_version_id" text,
  "source_meeting_id" text,
  "approval_status" text NOT NULL,
  "approval_requested_by_user_id" text,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "archived_at" timestamptz,
  CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "knowledge_documents_project_fk" FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "knowledge_documents_meeting_fk" FOREIGN KEY ("tenant_id", "source_meeting_id") REFERENCES "meetings"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "knowledge_documents_approval_user_fk" FOREIGN KEY ("tenant_id", "approval_requested_by_user_id") REFERENCES "tenant_users"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "knowledge_documents_created_by_fk" FOREIGN KEY ("tenant_id", "created_by_user_id") REFERENCES "tenant_users"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "knowledge_documents_type_chk" CHECK ("document_type" in ('project_brief', 'meeting_minutes', 'specification', 'decision_record', 'general')),
  CONSTRAINT "knowledge_documents_status_chk" CHECK ("status" in ('draft', 'active', 'archived')),
  CONSTRAINT "knowledge_documents_approval_status_chk" CHECK ("approval_status" in ('none', 'pending', 'approved', 'rejected'))
);

CREATE INDEX "knowledge_documents_tenant_project_updated_idx"
  ON "knowledge_documents" ("tenant_id", "project_id", "updated_at");

CREATE TABLE "knowledge_document_versions" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "document_id" text NOT NULL,
  "version_number" integer NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "summary" text,
  "change_reason" text,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  CONSTRAINT "knowledge_document_versions_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "knowledge_document_versions_document_fk" FOREIGN KEY ("tenant_id", "document_id") REFERENCES "knowledge_documents"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "knowledge_document_versions_created_by_fk" FOREIGN KEY ("tenant_id", "created_by_user_id") REFERENCES "tenant_users"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "knowledge_document_versions_number_chk" CHECK ("version_number" > 0)
);

CREATE UNIQUE INDEX "knowledge_document_versions_document_number_uidx"
  ON "knowledge_document_versions" ("tenant_id", "document_id", "version_number");

CREATE INDEX "knowledge_document_versions_document_created_idx"
  ON "knowledge_document_versions" ("tenant_id", "document_id", "created_at");

CREATE TABLE "decision_log_entries" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "project_id" text NOT NULL,
  "title" text NOT NULL,
  "decision" text NOT NULL,
  "rationale" text,
  "status" text NOT NULL,
  "source_meeting_id" text,
  "document_id" text,
  "supersedes_decision_id" text,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "archived_at" timestamptz,
  CONSTRAINT "decision_log_entries_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "decision_log_entries_project_fk" FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "decision_log_entries_meeting_fk" FOREIGN KEY ("tenant_id", "source_meeting_id") REFERENCES "meetings"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "decision_log_entries_document_fk" FOREIGN KEY ("tenant_id", "document_id") REFERENCES "knowledge_documents"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "decision_log_entries_supersedes_fk" FOREIGN KEY ("tenant_id", "supersedes_decision_id") REFERENCES "decision_log_entries"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "decision_log_entries_created_by_fk" FOREIGN KEY ("tenant_id", "created_by_user_id") REFERENCES "tenant_users"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "decision_log_entries_status_chk" CHECK ("status" in ('proposed', 'accepted', 'superseded', 'rejected'))
);

CREATE INDEX "decision_log_entries_tenant_project_updated_idx"
  ON "decision_log_entries" ("tenant_id", "project_id", "updated_at");

CREATE TABLE "knowledge_action_items" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "project_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "owner_user_id" text NOT NULL,
  "due_date" text,
  "status" text NOT NULL,
  "source_meeting_id" text,
  "document_id" text,
  "decision_id" text,
  "target_entity_type" text,
  "target_entity_id" text,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "archived_at" timestamptz,
  CONSTRAINT "knowledge_action_items_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "knowledge_action_items_project_fk" FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "knowledge_action_items_owner_fk" FOREIGN KEY ("tenant_id", "owner_user_id") REFERENCES "tenant_users"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "knowledge_action_items_meeting_fk" FOREIGN KEY ("tenant_id", "source_meeting_id") REFERENCES "meetings"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "knowledge_action_items_document_fk" FOREIGN KEY ("tenant_id", "document_id") REFERENCES "knowledge_documents"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "knowledge_action_items_decision_fk" FOREIGN KEY ("tenant_id", "decision_id") REFERENCES "decision_log_entries"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "knowledge_action_items_created_by_fk" FOREIGN KEY ("tenant_id", "created_by_user_id") REFERENCES "tenant_users"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "knowledge_action_items_status_chk" CHECK ("status" in ('open', 'done', 'cancelled')),
  CONSTRAINT "knowledge_action_items_target_type_chk" CHECK ("target_entity_type" is null or "target_entity_type" in ('project', 'task', 'opportunity', 'corrective_action')),
  CONSTRAINT "knowledge_action_items_target_pair_chk" CHECK (
    ("target_entity_type" is null and "target_entity_id" is null)
    or
    ("target_entity_type" is not null and "target_entity_id" is not null)
  )
);

CREATE INDEX "knowledge_action_items_tenant_project_updated_idx"
  ON "knowledge_action_items" ("tenant_id", "project_id", "updated_at");

ALTER TABLE "entity_attachments" DROP CONSTRAINT "entity_attachments_entity_type_chk";
ALTER TABLE "entity_attachments"
  ADD CONSTRAINT "entity_attachments_entity_type_chk"
  CHECK ("entity_type" in ('opportunity', 'client', 'contact', 'product', 'project', 'task', 'document'));
