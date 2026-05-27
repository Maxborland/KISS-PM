import {
  dateTimeSchema,
  nullableStringSchema,
  openApiSchemaFragment,
  planDateOrNullSchema,
  schemaRef,
  stringIdSchema
} from "./schemaPrimitives";

export const storageSearchKnowledgeSchemas = openApiSchemaFragment({
  AttachmentEntityType: {
    type: "string",
    enum: ["opportunity", "client", "contact", "product", "project", "task", "communication_channel", "document"]
  },
  AttachmentConnectorType: {
    type: "string",
    enum: ["manual_link", "bitrix24", "amocrm", "jira", "slack", "email", "s3", "local", "other"]
  },
  FileAssetSummary: {
    type: "object",
    required: ["id", "originalName", "safeDisplayName", "mimeType", "sizeBytes", "checksumSha256", "status", "createdAt"],
    properties: {
      id: stringIdSchema,
      originalName: { type: "string", minLength: 1 },
      safeDisplayName: { type: "string", minLength: 1 },
      mimeType: { type: "string", minLength: 1 },
      sizeBytes: { type: "integer", minimum: 1 },
      checksumSha256: nullableStringSchema,
      status: { type: "string", enum: ["pending", "ready", "archived", "failed"] },
      createdAt: dateTimeSchema
    },
    additionalProperties: false
  },
  ExternalReferenceSummary: {
    type: "object",
    required: ["id", "connectorType", "externalId", "url", "title", "metadata", "createdAt"],
    properties: {
      id: stringIdSchema,
      connectorType: schemaRef("AttachmentConnectorType"),
      externalId: nullableStringSchema,
      url: { type: "string", format: "uri", minLength: 1 },
      title: { type: "string", minLength: 1 },
      metadata: schemaRef("AnyJsonObject"),
      createdAt: dateTimeSchema
    },
    additionalProperties: false
  },
  EntityAttachment: {
    type: "object",
    required: [
      "id",
      "entityType",
      "entityId",
      "relationType",
      "kind",
      "fileAsset",
      "externalReference",
      "sourceActivityType",
      "sourceActivityId",
      "createdByUserId",
      "createdAt",
      "archivedAt"
    ],
    properties: {
      id: stringIdSchema,
      entityType: schemaRef("AttachmentEntityType"),
      entityId: stringIdSchema,
      relationType: { type: "string", minLength: 1 },
      kind: { type: "string", enum: ["file", "external_reference"] },
      fileAsset: { oneOf: [schemaRef("FileAssetSummary"), { type: "null" }] },
      externalReference: { oneOf: [schemaRef("ExternalReferenceSummary"), { type: "null" }] },
      sourceActivityType: { type: ["string", "null"], enum: ["crm", "task", null] },
      sourceActivityId: nullableStringSchema,
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  AttachmentsResponse: {
    type: "object",
    required: ["attachments"],
    properties: {
      attachments: { type: "array", items: schemaRef("EntityAttachment") }
    },
    additionalProperties: false
  },
  AttachmentResponse: {
    type: "object",
    required: ["attachment"],
    properties: {
      attachment: schemaRef("EntityAttachment")
    },
    additionalProperties: false
  },
  ExternalReferenceAttachRequest: {
    type: "object",
    required: ["entityType", "entityId", "connectorType", "url", "title", "relationType"],
    properties: {
      entityType: schemaRef("AttachmentEntityType"),
      entityId: stringIdSchema,
      connectorType: schemaRef("AttachmentConnectorType"),
      externalId: nullableStringSchema,
      url: { type: "string", format: "uri", minLength: 1 },
      title: { type: "string", minLength: 1, maxLength: 300 },
      metadata: schemaRef("AnyJsonObject"),
      relationType: { type: "string", minLength: 1, maxLength: 80 }
    },
    additionalProperties: false
  },
  FileAttachmentMultipartRequest: {
    type: "object",
    required: ["entityType", "entityId", "relationType", "file"],
    properties: {
      entityType: schemaRef("AttachmentEntityType"),
      entityId: stringIdSchema,
      relationType: { type: "string", minLength: 1, maxLength: 80 },
      file: { type: "string", format: "binary", description: "Uploaded file, max 25 MiB." }
    },
    additionalProperties: false
  },
  SearchResultType: {
    type: "string",
    enum: [
      "project",
      "task",
      "opportunity",
      "client",
      "contact",
      "product",
      "file",
      "external_reference",
      "document",
      "decision",
      "knowledge_action_item"
    ]
  },
  WorkspaceSearchResult: {
    type: "object",
    required: ["id", "type", "title", "subtitle", "snippet", "entityType", "entityId", "route", "updatedAt", "score", "source"],
    properties: {
      id: stringIdSchema,
      type: schemaRef("SearchResultType"),
      title: { type: "string" },
      subtitle: { type: "string" },
      snippet: { type: "string" },
      entityType: { type: "string", minLength: 1 },
      entityId: stringIdSchema,
      route: { type: "string", minLength: 1 },
      updatedAt: dateTimeSchema,
      score: { type: "number" },
      source: { type: "string", minLength: 1 }
    },
    additionalProperties: false
  },
  WorkspaceSearchResponse: {
    type: "object",
    required: ["results"],
    properties: {
      results: { type: "array", items: schemaRef("WorkspaceSearchResult") }
    },
    additionalProperties: false
  },
  KnowledgeDocument: {
    type: "object",
    required: [
      "id",
      "tenantId",
      "projectId",
      "title",
      "summary",
      "documentType",
      "status",
      "currentVersionId",
      "sourceMeetingId",
      "approvalStatus",
      "approvalRequestedByUserId",
      "createdByUserId",
      "createdAt",
      "updatedAt",
      "archivedAt"
    ],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      projectId: stringIdSchema,
      title: { type: "string", minLength: 1, maxLength: 180 },
      summary: { type: ["string", "null"], maxLength: 2000 },
      documentType: { type: "string", enum: ["project_brief", "meeting_minutes", "specification", "decision_record", "general"] },
      status: { type: "string", enum: ["draft", "active", "archived"] },
      currentVersionId: nullableStringSchema,
      sourceMeetingId: nullableStringSchema,
      approvalStatus: { type: "string", enum: ["none", "pending", "approved", "rejected"] },
      approvalRequestedByUserId: nullableStringSchema,
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  KnowledgeDocumentVersion: {
    type: "object",
    required: ["id", "tenantId", "documentId", "versionNumber", "title", "body", "summary", "changeReason", "createdByUserId", "createdAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      documentId: stringIdSchema,
      versionNumber: { type: "integer", minimum: 1 },
      title: { type: "string", minLength: 1, maxLength: 180 },
      body: { type: "string", minLength: 1, maxLength: 100000 },
      summary: { type: ["string", "null"], maxLength: 2000 },
      changeReason: { type: ["string", "null"], maxLength: 4000 },
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema
    },
    additionalProperties: false
  },
  KnowledgeDocumentCreateRequest: {
    type: "object",
    required: ["title", "body", "documentType"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 180 },
      body: { type: "string", minLength: 1, maxLength: 100000 },
      summary: { type: ["string", "null"], maxLength: 2000 },
      documentType: { type: "string", enum: ["project_brief", "meeting_minutes", "specification", "decision_record", "general"] },
      approvalStatus: { type: "string", enum: ["none", "pending", "approved", "rejected"], default: "none" },
      changeReason: { type: ["string", "null"], maxLength: 4000 },
      sourceMeetingId: nullableStringSchema
    },
    additionalProperties: false
  },
  KnowledgeDocumentVersionCreateRequest: {
    type: "object",
    required: ["title", "body"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 180 },
      body: { type: "string", minLength: 1, maxLength: 100000 },
      summary: { type: ["string", "null"], maxLength: 2000 },
      changeReason: { type: ["string", "null"], maxLength: 4000 }
    },
    additionalProperties: false
  },
  KnowledgeDocumentsResponse: {
    type: "object",
    required: ["documents"],
    properties: { documents: { type: "array", items: schemaRef("KnowledgeDocument") } },
    additionalProperties: false
  },
  KnowledgeDocumentResponse: {
    type: "object",
    required: ["document"],
    properties: { document: schemaRef("KnowledgeDocument") },
    additionalProperties: false
  },
  KnowledgeDocumentVersionResponse: {
    type: "object",
    required: ["document", "version"],
    properties: {
      document: schemaRef("KnowledgeDocument"),
      version: schemaRef("KnowledgeDocumentVersion")
    },
    additionalProperties: false
  },
  KnowledgeDocumentDetailResponse: {
    type: "object",
    required: ["document", "versions"],
    properties: {
      document: schemaRef("KnowledgeDocument"),
      versions: { type: "array", items: schemaRef("KnowledgeDocumentVersion") }
    },
    additionalProperties: false
  },
  KnowledgeDecision: {
    type: "object",
    required: ["id", "tenantId", "projectId", "title", "decision", "rationale", "status", "sourceMeetingId", "documentId", "supersedesDecisionId", "createdByUserId", "createdAt", "updatedAt", "archivedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      projectId: stringIdSchema,
      title: { type: "string", minLength: 1, maxLength: 180 },
      decision: { type: "string", minLength: 1, maxLength: 100000 },
      rationale: { type: ["string", "null"], maxLength: 4000 },
      status: { type: "string", enum: ["proposed", "accepted", "superseded", "rejected"] },
      sourceMeetingId: nullableStringSchema,
      documentId: nullableStringSchema,
      supersedesDecisionId: nullableStringSchema,
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  KnowledgeDecisionCreateRequest: {
    type: "object",
    required: ["title", "decision"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 180 },
      decision: { type: "string", minLength: 1, maxLength: 100000 },
      rationale: { type: ["string", "null"], maxLength: 4000 },
      status: { type: "string", enum: ["proposed", "accepted", "superseded", "rejected"], default: "proposed" },
      sourceMeetingId: nullableStringSchema,
      documentId: nullableStringSchema,
      supersedesDecisionId: nullableStringSchema
    },
    additionalProperties: false
  },
  KnowledgeDecisionUpdateRequest: {
    type: "object",
    properties: {
      title: { type: "string", minLength: 1, maxLength: 180 },
      decision: { type: "string", minLength: 1, maxLength: 100000 },
      rationale: { type: ["string", "null"], maxLength: 4000 },
      status: { type: "string", enum: ["proposed", "accepted", "superseded", "rejected"] }
    },
    additionalProperties: false
  },
  KnowledgeDecisionsResponse: {
    type: "object",
    required: ["decisions"],
    properties: { decisions: { type: "array", items: schemaRef("KnowledgeDecision") } },
    additionalProperties: false
  },
  KnowledgeDecisionResponse: {
    type: "object",
    required: ["decision"],
    properties: { decision: schemaRef("KnowledgeDecision") },
    additionalProperties: false
  },
  KnowledgeActionItem: {
    type: "object",
    required: ["id", "tenantId", "projectId", "title", "description", "ownerUserId", "dueDate", "status", "sourceMeetingId", "documentId", "decisionId", "targetEntityType", "targetEntityId", "createdByUserId", "createdAt", "updatedAt", "archivedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      projectId: stringIdSchema,
      title: { type: "string", minLength: 1, maxLength: 180 },
      description: { type: ["string", "null"], maxLength: 2000 },
      ownerUserId: stringIdSchema,
      dueDate: planDateOrNullSchema,
      status: { type: "string", enum: ["open", "done", "cancelled"] },
      sourceMeetingId: nullableStringSchema,
      documentId: nullableStringSchema,
      decisionId: nullableStringSchema,
      targetEntityType: { type: ["string", "null"], enum: ["project", "task", "opportunity", "corrective_action", null] },
      targetEntityId: nullableStringSchema,
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  KnowledgeActionItemCreateRequest: {
    type: "object",
    required: ["title", "ownerUserId"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 180 },
      description: { type: ["string", "null"], maxLength: 2000 },
      ownerUserId: stringIdSchema,
      dueDate: planDateOrNullSchema,
      status: { type: "string", enum: ["open", "done", "cancelled"], default: "open" },
      sourceMeetingId: nullableStringSchema,
      documentId: nullableStringSchema,
      decisionId: nullableStringSchema,
      targetEntityType: { type: ["string", "null"], enum: ["project", "task", "opportunity", "corrective_action", null] },
      targetEntityId: nullableStringSchema
    },
    additionalProperties: false
  },
  KnowledgeActionItemUpdateRequest: {
    type: "object",
    properties: {
      title: { type: "string", minLength: 1, maxLength: 180 },
      description: { type: ["string", "null"], maxLength: 2000 },
      ownerUserId: stringIdSchema,
      dueDate: planDateOrNullSchema,
      status: { type: "string", enum: ["open", "done", "cancelled"] }
    },
    additionalProperties: false
  },
  KnowledgeActionItemsResponse: {
    type: "object",
    required: ["actionItems"],
    properties: { actionItems: { type: "array", items: schemaRef("KnowledgeActionItem") } },
    additionalProperties: false
  },
  KnowledgeActionItemResponse: {
    type: "object",
    required: ["actionItem"],
    properties: { actionItem: schemaRef("KnowledgeActionItem") },
    additionalProperties: false
  }
});
