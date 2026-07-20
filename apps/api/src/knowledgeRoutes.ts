import { randomUUID } from "node:crypto";

import {
  canManageProjects,
  canReadProjects,
  type PolicyDecision
} from "@kiss-pm/access-control";
import {
  parseDecisionLogStatus,
  parseKnowledgeActionItemStatus,
  parseKnowledgeActionTargetType,
  parseKnowledgeApprovalStatus,
  parseKnowledgeBody,
  parseKnowledgeDocumentType,
  parseKnowledgeDueDate,
  parseKnowledgeId,
  parseKnowledgeReason,
  parseKnowledgeSummary,
  parseKnowledgeTitle,
  parseOptionalKnowledgeId,
  type DecisionLogEntry,
  type KnowledgeActionItem,
  type KnowledgeActionTargetType,
  type KnowledgeDocument,
  type KnowledgeDocumentVersion,
  type TenantUser
} from "@kiss-pm/domain";
import type { Hono } from "hono";

import type { ApiTenantDataSource, ManagementAuditEventInput, ProjectRecord } from "./apiTypes";
import { readLimitedJsonBody } from "./jsonBody";
import type { ApiRouteDeps } from "./routeTypes";

type ProjectAccessContext = {
  project: ProjectRecord;
  readDecision: PolicyDecision;
  manageDecision: PolicyDecision;
};

export function registerKnowledgeRoutes(app: Hono, deps: ApiRouteDeps) {
  app.get("/api/workspace/projects/:projectId/knowledge/documents", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const access = await resolveProjectAccess(context.req.param("projectId"), actor, deps);
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!access.value.readDecision.allowed) {
      return context.json({ error: access.value.readDecision.reason }, 403);
    }
    const documents = await deps.dataSource.listKnowledgeDocuments?.({
      tenantId: actor.tenantId,
      projectId: access.value.project.id
    });
    if (!documents) return context.json({ error: "knowledge_not_configured" }, 501);
    return context.json({ documents: documents.map(serializeDocument) });
  });

  app.post("/api/workspace/projects/:projectId/knowledge/documents", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const access = await requireProjectManage(context.req.param("projectId"), actor, deps, {
      actionType: "knowledge.document_created",
      commandInput: {}
    });
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = await parseDocumentCreate(readRecord(body.value), actor, access.value.project.id, deps.dataSource);
    if (!parsed.ok) return context.json({ error: parsed.error }, knowledgeErrorStatus(parsed));
    if (!deps.dataSource.createKnowledgeDocument || !deps.dataSource.createKnowledgeDocumentVersion) {
      return context.json({ error: "knowledge_not_configured" }, 501);
    }

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const document = await requireMethod(transactionDataSource.createKnowledgeDocument).call(
        transactionDataSource,
        parsed.value.document
      );
      const version = await requireMethod(transactionDataSource.createKnowledgeDocumentVersion).call(
        transactionDataSource,
        {
          ...parsed.value.version,
          documentId: document.id
        }
      );
      await deps.appendManagementAuditEvent(
        knowledgeAudit({
          actionType: "knowledge.document_created",
          actor,
          projectId: access.value.project.id,
          commandInput: safeDocumentInput(document),
          permissionResult: access.value.manageDecision,
          afterState: {
            documentId: version.document.id,
            currentVersionId: version.version.id,
            documentType: document.documentType
          }
        }),
        transactionDataSource
      );
      return version;
    });

    return context.json({
      document: serializeDocument(result.document),
      version: serializeVersion(result.version)
    }, 201);
  });

  app.get("/api/workspace/projects/:projectId/knowledge/documents/:documentId", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const access = await resolveProjectAccess(context.req.param("projectId"), actor, deps);
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!access.value.readDecision.allowed) {
      return context.json({ error: access.value.readDecision.reason }, 403);
    }
    const documentId = parseKnowledgeId(context.req.param("documentId"), "knowledge_document_id_invalid");
    if (!documentId.ok) return context.json({ error: documentId.error }, 400);
    if (!deps.dataSource.findKnowledgeDocument) {
      return context.json({ error: "knowledge_not_configured" }, 501);
    }
    const document = await deps.dataSource.findKnowledgeDocument({
      tenantId: actor.tenantId,
      projectId: access.value.project.id,
      documentId: documentId.value
    });
    if (!document) return context.json({ error: "knowledge_document_not_found" }, 404);
    const versions = await deps.dataSource.listKnowledgeDocumentVersions?.({
      tenantId: actor.tenantId,
      documentId: document.id
    });
    if (!versions) return context.json({ error: "knowledge_not_configured" }, 501);
    return context.json({
      document: serializeDocument(document),
      versions: versions.map(serializeVersion)
    });
  });

  app.post("/api/workspace/projects/:projectId/knowledge/documents/:documentId/versions", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const documentId = parseKnowledgeId(context.req.param("documentId"), "knowledge_document_id_invalid");
    if (!documentId.ok) return context.json({ error: documentId.error }, 400);
    const access = await requireProjectManage(context.req.param("projectId"), actor, deps, {
      actionType: "knowledge.document_version_created",
      commandInput: { documentId: documentId.value }
    });
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!deps.dataSource.findKnowledgeDocument || !deps.dataSource.createKnowledgeDocumentVersion) {
      return context.json({ error: "knowledge_not_configured" }, 501);
    }
    const document = await deps.dataSource.findKnowledgeDocument({
      tenantId: actor.tenantId,
      projectId: access.value.project.id,
      documentId: documentId.value
    });
    if (!document) return context.json({ error: "knowledge_document_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseDocumentVersionBody(readRecord(body.value), actor, document.id);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    let result: Awaited<ReturnType<NonNullable<ApiTenantDataSource["createKnowledgeDocumentVersion"]>>>;
    try {
      result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
        const version = await requireMethod(transactionDataSource.createKnowledgeDocumentVersion).call(
          transactionDataSource,
          parsed.value
        );
        await deps.appendManagementAuditEvent(knowledgeAudit({
          actionType: "knowledge.document_version_created",
          actor,
          projectId: access.value.project.id,
          commandInput: { documentId: document.id, title: parsed.value.title },
          permissionResult: access.value.manageDecision,
          afterState: { versionId: version.version.id, versionNumber: version.version.versionNumber }
        }), transactionDataSource);
        return version;
      });
    } catch (error) {
      if (isKnowledgeVersionConflict(error)) {
        return context.json({ error: "knowledge_version_conflict" }, 409);
      }
      throw error;
    }
    return context.json({
      document: serializeDocument(result.document),
      version: serializeVersion(result.version)
    }, 201);
  });

  app.post(
    "/api/workspace/projects/:projectId/knowledge/documents/:documentId/versions/:versionId/restore",
    async (context) => {
      const actor = await requireActor(context.req.header("cookie") ?? null, deps);
      if (!actor) return context.json({ error: "session_required" }, 401);
      const documentId = parseKnowledgeId(context.req.param("documentId"), "knowledge_document_id_invalid");
      if (!documentId.ok) return context.json({ error: documentId.error }, 400);
      const versionId = parseKnowledgeId(context.req.param("versionId"), "knowledge_document_version_id_invalid");
      if (!versionId.ok) return context.json({ error: versionId.error }, 400);
      const access = await requireProjectManage(context.req.param("projectId"), actor, deps, {
        actionType: "knowledge.document_version_restored",
        commandInput: { documentId: documentId.value, versionId: versionId.value }
      });
      if (!access.ok) return context.json({ error: access.error }, access.status);
      if (!deps.dataSource.findKnowledgeDocument || !deps.dataSource.restoreKnowledgeDocumentVersion) {
        return context.json({ error: "knowledge_not_configured" }, 501);
      }
      const document = await deps.dataSource.findKnowledgeDocument({
        tenantId: actor.tenantId,
        projectId: access.value.project.id,
        documentId: documentId.value
      });
      if (!document) return context.json({ error: "knowledge_document_not_found" }, 404);
      let result: Awaited<ReturnType<NonNullable<ApiTenantDataSource["restoreKnowledgeDocumentVersion"]>>>;
      try {
        result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
          const restored = await requireMethod(transactionDataSource.restoreKnowledgeDocumentVersion).call(
            transactionDataSource,
            {
              tenantId: actor.tenantId,
              projectId: access.value.project.id,
              documentId: documentId.value,
              versionId: versionId.value,
              newVersionId: `knowledge-doc-version-${randomUUID()}`,
              createdByUserId: actor.id
            }
          );
          if (!restored) return undefined;
          await deps.appendManagementAuditEvent(knowledgeAudit({
            actionType: "knowledge.document_version_restored",
            actor,
            projectId: access.value.project.id,
            commandInput: { documentId: restored.document.id, restoredFromVersionId: versionId.value },
            permissionResult: access.value.manageDecision,
            afterState: {
              versionId: restored.version.id,
              versionNumber: restored.version.versionNumber,
              currentVersionId: restored.document.currentVersionId
            }
          }), transactionDataSource);
          return restored;
        });
      } catch (error) {
        if (isKnowledgeVersionConflict(error)) {
          return context.json({ error: "knowledge_version_conflict" }, 409);
        }
        throw error;
      }
      if (!result) return context.json({ error: "knowledge_document_version_not_found" }, 404);
      return context.json({
        document: serializeDocument(result.document),
        version: serializeVersion(result.version)
      }, 201);
    }
  );

  app.delete("/api/workspace/projects/:projectId/knowledge/documents/:documentId", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const documentId = parseKnowledgeId(context.req.param("documentId"), "knowledge_document_id_invalid");
    if (!documentId.ok) return context.json({ error: documentId.error }, 400);
    const access = await requireProjectManage(context.req.param("projectId"), actor, deps, {
      actionType: "knowledge.document_archived",
      commandInput: { documentId: documentId.value }
    });
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!deps.dataSource.archiveKnowledgeDocument) {
      return context.json({ error: "knowledge_not_configured" }, 501);
    }
    const archived = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const archivedDocument = await requireMethod(transactionDataSource.archiveKnowledgeDocument).call(
        transactionDataSource,
        {
          tenantId: actor.tenantId,
          projectId: access.value.project.id,
          documentId: documentId.value
        }
      );
      if (!archivedDocument) return undefined;
      await deps.appendManagementAuditEvent(knowledgeAudit({
        actionType: "knowledge.document_archived",
        actor,
        projectId: access.value.project.id,
        commandInput: { documentId: archivedDocument.id },
        permissionResult: access.value.manageDecision,
        afterState: {
          status: archivedDocument.status,
          archivedAt: archivedDocument.archivedAt?.toISOString() ?? null
        }
      }), transactionDataSource);
      return archivedDocument;
    });
    if (!archived) return context.json({ error: "knowledge_document_not_found" }, 404);
    return context.json({ document: serializeDocument(archived) });
  });

  app.get("/api/workspace/projects/:projectId/knowledge/decisions", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const access = await resolveProjectAccess(context.req.param("projectId"), actor, deps);
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!access.value.readDecision.allowed) {
      return context.json({ error: access.value.readDecision.reason }, 403);
    }
    const decisions = await deps.dataSource.listDecisionLogEntries?.({
      tenantId: actor.tenantId,
      projectId: access.value.project.id
    });
    if (!decisions) return context.json({ error: "knowledge_not_configured" }, 501);
    return context.json({ decisions: decisions.map(serializeDecision) });
  });

  app.post("/api/workspace/projects/:projectId/knowledge/decisions", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const access = await requireProjectManage(context.req.param("projectId"), actor, deps, {
      actionType: "knowledge.decision_recorded",
      commandInput: {}
    });
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = await parseDecisionCreate(readRecord(body.value), actor, access.value.project.id, deps.dataSource);
    if (!parsed.ok) return context.json({ error: parsed.error }, knowledgeErrorStatus(parsed));
    if (!deps.dataSource.createDecisionLogEntry) {
      return context.json({ error: "knowledge_not_configured" }, 501);
    }
    const decision = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const createdDecision = await requireMethod(transactionDataSource.createDecisionLogEntry).call(
        transactionDataSource,
        parsed.value
      );
      await deps.appendManagementAuditEvent(knowledgeAudit({
        actionType: "knowledge.decision_recorded",
        actor,
        projectId: access.value.project.id,
        commandInput: safeDecisionInput(createdDecision),
        permissionResult: access.value.manageDecision,
        afterState: { decisionId: createdDecision.id, status: createdDecision.status }
      }), transactionDataSource);
      return createdDecision;
    });
    return context.json({ decision: serializeDecision(decision) }, 201);
  });

  app.patch("/api/workspace/projects/:projectId/knowledge/decisions/:decisionId", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const decisionId = parseKnowledgeId(context.req.param("decisionId"), "knowledge_decision_id_invalid");
    if (!decisionId.ok) return context.json({ error: decisionId.error }, 400);
    const access = await requireProjectManage(context.req.param("projectId"), actor, deps, {
      actionType: "knowledge.decision_updated",
      commandInput: { decisionId: decisionId.value }
    });
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!deps.dataSource.findDecisionLogEntry) {
      return context.json({ error: "knowledge_not_configured" }, 501);
    }
    const existing = await deps.dataSource.findDecisionLogEntry({
      tenantId: actor.tenantId,
      projectId: access.value.project.id,
      decisionId: decisionId.value
    });
    if (!existing) return context.json({ error: "knowledge_decision_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseDecisionUpdate(readRecord(body.value), existing);
    if (!parsed.ok) return context.json({ error: parsed.error }, knowledgeErrorStatus(parsed));
    if (!deps.dataSource.updateDecisionLogEntry) {
      return context.json({ error: "knowledge_not_configured" }, 501);
    }
    const decision = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const updatedDecision = await requireMethod(transactionDataSource.updateDecisionLogEntry).call(
        transactionDataSource,
        {
          tenantId: actor.tenantId,
          projectId: access.value.project.id,
          decisionId: existing.id,
          ...parsed.value
        }
      );
      if (!updatedDecision) return undefined;
      await deps.appendManagementAuditEvent(knowledgeAudit({
        actionType: "knowledge.decision_updated",
        actor,
        projectId: access.value.project.id,
        commandInput: { decisionId: updatedDecision.id },
        permissionResult: access.value.manageDecision,
        beforeState: { status: existing.status, title: existing.title },
        afterState: { status: updatedDecision.status, title: updatedDecision.title }
      }), transactionDataSource);
      return updatedDecision;
    });
    if (!decision) return context.json({ error: "knowledge_decision_not_found" }, 404);
    return context.json({ decision: serializeDecision(decision) });
  });

  app.delete("/api/workspace/projects/:projectId/knowledge/decisions/:decisionId", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const decisionId = parseKnowledgeId(context.req.param("decisionId"), "knowledge_decision_id_invalid");
    if (!decisionId.ok) return context.json({ error: decisionId.error }, 400);
    const access = await requireProjectManage(context.req.param("projectId"), actor, deps, {
      actionType: "knowledge.decision_deleted",
      commandInput: { decisionId: decisionId.value }
    });
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!deps.dataSource.deleteKnowledgeDecision) {
      return context.json({ error: "knowledge_not_configured" }, 501);
    }
    const deleted = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const removed = await requireMethod(transactionDataSource.deleteKnowledgeDecision).call(
        transactionDataSource,
        {
          tenantId: actor.tenantId,
          projectId: access.value.project.id,
          decisionId: decisionId.value
        }
      );
      if (!removed) return undefined;
      await deps.appendManagementAuditEvent(knowledgeAudit({
        actionType: "knowledge.decision_deleted",
        actor,
        projectId: access.value.project.id,
        commandInput: { decisionId: removed.id },
        permissionResult: access.value.manageDecision,
        beforeState: { status: removed.status, title: removed.title },
        afterState: { archivedAt: removed.archivedAt?.toISOString() ?? null }
      }), transactionDataSource);
      return removed;
    });
    if (!deleted) return context.json({ error: "knowledge_decision_not_found" }, 404);
    return context.json({ decision: serializeDecision(deleted) });
  });

  app.get("/api/workspace/projects/:projectId/knowledge/action-items", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const access = await resolveProjectAccess(context.req.param("projectId"), actor, deps);
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!access.value.readDecision.allowed) {
      return context.json({ error: access.value.readDecision.reason }, 403);
    }
    const actionItems = await deps.dataSource.listKnowledgeActionItems?.({
      tenantId: actor.tenantId,
      projectId: access.value.project.id
    });
    if (!actionItems) return context.json({ error: "knowledge_not_configured" }, 501);
    return context.json({ actionItems: actionItems.map(serializeActionItem) });
  });

  app.post("/api/workspace/projects/:projectId/knowledge/action-items", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const access = await requireProjectManage(context.req.param("projectId"), actor, deps, {
      actionType: "knowledge.action_item_created",
      commandInput: {}
    });
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = await parseActionItemCreate(readRecord(body.value), actor, access.value.project.id, deps.dataSource);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (!deps.dataSource.createKnowledgeActionItem) {
      return context.json({ error: "knowledge_not_configured" }, 501);
    }
    const actionItem = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const createdActionItem = await requireMethod(transactionDataSource.createKnowledgeActionItem).call(
        transactionDataSource,
        parsed.value
      );
      await deps.appendManagementAuditEvent(knowledgeAudit({
        actionType: "knowledge.action_item_created",
        actor,
        projectId: access.value.project.id,
        commandInput: safeActionItemInput(createdActionItem),
        permissionResult: access.value.manageDecision,
        afterState: { actionItemId: createdActionItem.id, status: createdActionItem.status }
      }), transactionDataSource);
      return createdActionItem;
    });
    return context.json({ actionItem: serializeActionItem(actionItem) }, 201);
  });

  app.patch("/api/workspace/projects/:projectId/knowledge/action-items/:actionItemId", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const actionItemId = parseKnowledgeId(context.req.param("actionItemId"), "knowledge_action_item_id_invalid");
    if (!actionItemId.ok) return context.json({ error: actionItemId.error }, 400);
    const access = await requireProjectManage(context.req.param("projectId"), actor, deps, {
      actionType: "knowledge.action_item_updated",
      commandInput: { actionItemId: actionItemId.value }
    });
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!deps.dataSource.findKnowledgeActionItem) {
      return context.json({ error: "knowledge_not_configured" }, 501);
    }
    const existing = await deps.dataSource.findKnowledgeActionItem({
      tenantId: actor.tenantId,
      projectId: access.value.project.id,
      actionItemId: actionItemId.value
    });
    if (!existing) return context.json({ error: "knowledge_action_item_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = await parseActionItemUpdate(readRecord(body.value), existing, deps.dataSource, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, knowledgeErrorStatus(parsed));
    if (!deps.dataSource.updateKnowledgeActionItem) {
      return context.json({ error: "knowledge_not_configured" }, 501);
    }
    const actionItem = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const updatedActionItem = await requireMethod(transactionDataSource.updateKnowledgeActionItem).call(
        transactionDataSource,
        {
          tenantId: actor.tenantId,
          projectId: access.value.project.id,
          actionItemId: existing.id,
          ...parsed.value
        }
      );
      if (!updatedActionItem) return undefined;
      await deps.appendManagementAuditEvent(knowledgeAudit({
        actionType: "knowledge.action_item_updated",
        actor,
        projectId: access.value.project.id,
        commandInput: { actionItemId: updatedActionItem.id },
        permissionResult: access.value.manageDecision,
        beforeState: { status: existing.status, ownerUserId: existing.ownerUserId },
        afterState: { status: updatedActionItem.status, ownerUserId: updatedActionItem.ownerUserId }
      }), transactionDataSource);
      return updatedActionItem;
    });
    if (!actionItem) return context.json({ error: "knowledge_action_item_not_found" }, 404);
    return context.json({ actionItem: serializeActionItem(actionItem) });
  });

  app.delete("/api/workspace/projects/:projectId/knowledge/action-items/:actionItemId", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const actionItemId = parseKnowledgeId(context.req.param("actionItemId"), "knowledge_action_item_id_invalid");
    if (!actionItemId.ok) return context.json({ error: actionItemId.error }, 400);
    const access = await requireProjectManage(context.req.param("projectId"), actor, deps, {
      actionType: "knowledge.action_item_deleted",
      commandInput: { actionItemId: actionItemId.value }
    });
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!deps.dataSource.deleteKnowledgeActionItem) {
      return context.json({ error: "knowledge_not_configured" }, 501);
    }
    const deleted = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const removed = await requireMethod(transactionDataSource.deleteKnowledgeActionItem).call(
        transactionDataSource,
        {
          tenantId: actor.tenantId,
          projectId: access.value.project.id,
          actionItemId: actionItemId.value
        }
      );
      if (!removed) return undefined;
      await deps.appendManagementAuditEvent(knowledgeAudit({
        actionType: "knowledge.action_item_deleted",
        actor,
        projectId: access.value.project.id,
        commandInput: { actionItemId: removed.id },
        permissionResult: access.value.manageDecision,
        beforeState: { status: removed.status, title: removed.title },
        afterState: { archivedAt: removed.archivedAt?.toISOString() ?? null }
      }), transactionDataSource);
      return removed;
    });
    if (!deleted) return context.json({ error: "knowledge_action_item_not_found" }, 404);
    return context.json({ actionItem: serializeActionItem(deleted) });
  });
}

async function requireActor(cookie: string | null, deps: ApiRouteDeps): Promise<TenantUser | undefined> {
  return deps.getSessionActorFromHeaders(cookie);
}

async function resolveProjectAccess(
  projectIdRaw: string,
  actor: TenantUser,
  deps: ApiRouteDeps
): Promise<
  | { ok: true; value: ProjectAccessContext }
  | { ok: false; status: 400 | 404; error: string }
> {
  const projectId = parseKnowledgeId(projectIdRaw, "knowledge_project_id_invalid");
  if (!projectId.ok) return { ok: false, status: 400, error: projectId.error };
  const project = await findProject(deps.dataSource, actor.tenantId, projectId.value);
  if (!project) return { ok: false, status: 404, error: "knowledge_project_not_found" };
  const profile = await deps.getActorProfile(actor);
  const policyInput = { actor, profile, targetTenantId: actor.tenantId };
  return {
    ok: true,
    value: {
      project,
      readDecision: canReadProjects(policyInput),
      manageDecision: canManageProjects(policyInput)
    }
  };
}

async function requireProjectManage(
  projectIdRaw: string,
  actor: TenantUser,
  deps: ApiRouteDeps,
  audit: { actionType: string; commandInput: Record<string, unknown> }
): Promise<
  | { ok: true; value: ProjectAccessContext }
  | { ok: false; status: 400 | 403 | 404; error: string }
> {
  const access = await resolveProjectAccess(projectIdRaw, actor, deps);
  if (!access.ok) return access;
  if (!access.value.manageDecision.allowed) {
    await deps.appendManagementAuditEvent(knowledgeAudit({
      actionType: "knowledge.denied",
      actor,
      projectId: access.value.project.id,
      commandInput: {
        attemptedAction: audit.actionType,
        ...audit.commandInput
      },
      permissionResult: access.value.manageDecision,
      executionResult: { status: "denied" }
    }));
    return { ok: false, status: 403, error: access.value.manageDecision.reason };
  }
  return access;
}

async function findProject(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  projectId: string
): Promise<ProjectRecord | undefined> {
  return (await dataSource.listProjects?.(tenantId))?.find((project) => project.id === projectId);
}

async function parseDocumentCreate(
  record: Record<string, unknown>,
  actor: TenantUser,
  projectId: string,
  dataSource: ApiTenantDataSource
) {
  const title = parseKnowledgeTitle(record.title);
  if (!title.ok) return title;
  const body = parseKnowledgeBody(record.body);
  if (!body.ok) return body;
  const summary = parseKnowledgeSummary(record.summary);
  if (!summary.ok) return summary;
  const documentType = parseKnowledgeDocumentType(record.documentType);
  if (!documentType.ok) return documentType;
  const approvalStatus = parseKnowledgeApprovalStatus(record.approvalStatus);
  if (!approvalStatus.ok) return approvalStatus;
  const changeReason = parseKnowledgeReason(record.changeReason);
  if (!changeReason.ok) return changeReason;
  const sourceMeetingId = parseOptionalKnowledgeId(record.sourceMeetingId, "knowledge_source_meeting_id_invalid");
  if (!sourceMeetingId.ok) return sourceMeetingId;
  const meetingValid = await validateMeetingLink(dataSource, actor.tenantId, projectId, sourceMeetingId.value);
  if (!meetingValid.ok) return meetingValid;
  const documentId = `knowledge-doc-${randomUUID()}`;
  return { ok: true as const, value: {
    document: {
      id: documentId,
      tenantId: actor.tenantId,
      projectId,
      title: title.value,
      summary: summary.value,
      documentType: documentType.value,
      status: "active" as const,
      sourceMeetingId: sourceMeetingId.value,
      approvalStatus: approvalStatus.value,
      approvalRequestedByUserId: approvalStatus.value === "pending" ? actor.id : null,
      createdByUserId: actor.id
    },
    version: {
      id: `knowledge-doc-version-${randomUUID()}`,
      tenantId: actor.tenantId,
      documentId,
      title: title.value,
      body: body.value,
      summary: summary.value,
      changeReason: changeReason.value,
      createdByUserId: actor.id
    }
  } };
}

function parseDocumentVersionBody(record: Record<string, unknown>, actor: TenantUser, documentId: string) {
  const title = parseKnowledgeTitle(record.title);
  if (!title.ok) return title;
  const body = parseKnowledgeBody(record.body);
  if (!body.ok) return body;
  const summary = parseKnowledgeSummary(record.summary);
  if (!summary.ok) return summary;
  const changeReason = parseKnowledgeReason(record.changeReason);
  if (!changeReason.ok) return changeReason;
  return { ok: true as const, value: {
    id: `knowledge-doc-version-${randomUUID()}`,
    tenantId: actor.tenantId,
    documentId,
    title: title.value,
    body: body.value,
    summary: summary.value,
    changeReason: changeReason.value,
    createdByUserId: actor.id
  } };
}

async function parseDecisionCreate(
  record: Record<string, unknown>,
  actor: TenantUser,
  projectId: string,
  dataSource: ApiTenantDataSource
) {
  const title = parseKnowledgeTitle(record.title);
  if (!title.ok) return title;
  const decision = parseKnowledgeBody(record.decision);
  if (!decision.ok) return decision;
  const rationale = parseKnowledgeReason(record.rationale);
  if (!rationale.ok) return rationale;
  const status = parseDecisionLogStatus(record.status);
  if (!status.ok) return status;
  const sourceMeetingId = parseOptionalKnowledgeId(record.sourceMeetingId, "knowledge_source_meeting_id_invalid");
  if (!sourceMeetingId.ok) return sourceMeetingId;
  const documentId = parseOptionalKnowledgeId(record.documentId, "knowledge_document_id_invalid");
  if (!documentId.ok) return documentId;
  const supersedesDecisionId = parseOptionalKnowledgeId(record.supersedesDecisionId, "knowledge_decision_id_invalid");
  if (!supersedesDecisionId.ok) return supersedesDecisionId;
  const links = await validateKnowledgeLinks(dataSource, actor.tenantId, projectId, {
    sourceMeetingId: sourceMeetingId.value,
    documentId: documentId.value,
    decisionId: supersedesDecisionId.value
  });
  if (!links.ok) return links;
  return { ok: true as const, value: {
    id: `decision-${randomUUID()}`,
    tenantId: actor.tenantId,
    projectId,
    title: title.value,
    decision: decision.value,
    rationale: rationale.value,
    status: status.value,
    sourceMeetingId: sourceMeetingId.value,
    documentId: documentId.value,
    supersedesDecisionId: supersedesDecisionId.value,
    createdByUserId: actor.id
  } };
}

function parseDecisionUpdate(record: Record<string, unknown>, existing: DecisionLogEntry) {
  const title = record.title === undefined
    ? { ok: true as const, value: existing.title }
    : parseKnowledgeTitle(record.title);
  if (!title.ok) return title;
  const decision = record.decision === undefined
    ? { ok: true as const, value: existing.decision }
    : parseKnowledgeBody(record.decision);
  if (!decision.ok) return decision;
  const rationale = record.rationale === undefined
    ? { ok: true as const, value: existing.rationale }
    : parseKnowledgeReason(record.rationale);
  if (!rationale.ok) return rationale;
  const status = record.status === undefined
    ? { ok: true as const, value: existing.status }
    : parseDecisionLogStatus(record.status);
  if (!status.ok) return status;
  return { ok: true as const, value: {
    title: title.value,
    decision: decision.value,
    rationale: rationale.value,
    status: status.value
  } };
}

async function parseActionItemCreate(
  record: Record<string, unknown>,
  actor: TenantUser,
  projectId: string,
  dataSource: ApiTenantDataSource
) {
  const title = parseKnowledgeTitle(record.title);
  if (!title.ok) return title;
  const description = parseKnowledgeSummary(record.description);
  if (!description.ok) return description;
  const ownerUserId = parseKnowledgeId(record.ownerUserId, "knowledge_action_owner_invalid");
  if (!ownerUserId.ok) return ownerUserId;
  const ownerValid = await validateTenantUser(dataSource, actor.tenantId, ownerUserId.value);
  if (!ownerValid.ok) return ownerValid;
  const dueDate = parseKnowledgeDueDate(record.dueDate);
  if (!dueDate.ok) return dueDate;
  const status = parseKnowledgeActionItemStatus(record.status);
  if (!status.ok) return status;
  const sourceMeetingId = parseOptionalKnowledgeId(record.sourceMeetingId, "knowledge_source_meeting_id_invalid");
  if (!sourceMeetingId.ok) return sourceMeetingId;
  const documentId = parseOptionalKnowledgeId(record.documentId, "knowledge_document_id_invalid");
  if (!documentId.ok) return documentId;
  const decisionId = parseOptionalKnowledgeId(record.decisionId, "knowledge_decision_id_invalid");
  if (!decisionId.ok) return decisionId;
  const targetEntityType = parseKnowledgeActionTargetType(record.targetEntityType);
  if (!targetEntityType.ok) return targetEntityType;
  const targetEntityId = parseOptionalKnowledgeId(record.targetEntityId, "knowledge_action_target_id_invalid");
  if (!targetEntityId.ok) return targetEntityId;
  if ((targetEntityType.value === null) !== (targetEntityId.value === null)) {
    return { ok: false as const, error: "knowledge_action_target_invalid" };
  }
  const targetValid = await validateKnowledgeActionTarget(
    dataSource,
    actor.tenantId,
    projectId,
    targetEntityType.value,
    targetEntityId.value
  );
  if (!targetValid.ok) return targetValid;
  const links = await validateKnowledgeLinks(dataSource, actor.tenantId, projectId, {
    sourceMeetingId: sourceMeetingId.value,
    documentId: documentId.value,
    decisionId: decisionId.value
  });
  if (!links.ok) return links;
  return { ok: true as const, value: {
    id: `knowledge-action-${randomUUID()}`,
    tenantId: actor.tenantId,
    projectId,
    title: title.value,
    description: description.value,
    ownerUserId: ownerUserId.value,
    dueDate: dueDate.value,
    status: status.value,
    sourceMeetingId: sourceMeetingId.value,
    documentId: documentId.value,
    decisionId: decisionId.value,
    targetEntityType: targetEntityType.value,
    targetEntityId: targetEntityId.value,
    createdByUserId: actor.id
  } };
}

async function parseActionItemUpdate(
  record: Record<string, unknown>,
  existing: KnowledgeActionItem,
  dataSource: ApiTenantDataSource,
  tenantId: string
) {
  const title = record.title === undefined
    ? { ok: true as const, value: existing.title }
    : parseKnowledgeTitle(record.title);
  if (!title.ok) return title;
  const description = record.description === undefined
    ? { ok: true as const, value: existing.description }
    : parseKnowledgeSummary(record.description);
  if (!description.ok) return description;
  const ownerUserId = record.ownerUserId === undefined
    ? { ok: true as const, value: existing.ownerUserId }
    : parseKnowledgeId(record.ownerUserId, "knowledge_action_owner_invalid");
  if (!ownerUserId.ok) return ownerUserId;
  const ownerValid = await validateTenantUser(dataSource, tenantId, ownerUserId.value);
  if (!ownerValid.ok) return ownerValid;
  const dueDate = record.dueDate === undefined
    ? { ok: true as const, value: existing.dueDate }
    : parseKnowledgeDueDate(record.dueDate);
  if (!dueDate.ok) return dueDate;
  const status = record.status === undefined
    ? { ok: true as const, value: existing.status }
    : parseKnowledgeActionItemStatus(record.status);
  if (!status.ok) return status;
  return { ok: true as const, value: {
    title: title.value,
    description: description.value,
    ownerUserId: ownerUserId.value,
    dueDate: dueDate.value,
    status: status.value
  } };
}

async function validateKnowledgeLinks(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  projectId: string,
  links: { sourceMeetingId?: string | null; documentId?: string | null; decisionId?: string | null }
) {
  const meeting = await validateMeetingLink(dataSource, tenantId, projectId, links.sourceMeetingId ?? null);
  if (!meeting.ok) return meeting;
  if (links.documentId) {
    if (!dataSource.findKnowledgeDocument) {
      return { ok: false as const, status: 501 as const, error: "knowledge_not_configured" };
    }
    const document = await dataSource.findKnowledgeDocument({
      tenantId,
      projectId,
      documentId: links.documentId
    });
    if (!document) return { ok: false as const, error: "knowledge_document_not_found" };
  }
  if (links.decisionId) {
    if (!dataSource.findDecisionLogEntry) {
      return { ok: false as const, status: 501 as const, error: "knowledge_not_configured" };
    }
    const decision = await dataSource.findDecisionLogEntry({
      tenantId,
      projectId,
      decisionId: links.decisionId
    });
    if (!decision) return { ok: false as const, error: "knowledge_decision_not_found" };
  }
  return { ok: true as const };
}

async function validateKnowledgeActionTarget(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  projectId: string,
  targetType: KnowledgeActionTargetType | null,
  targetId: string | null
) {
  if (!targetType || !targetId) return { ok: true as const };
  if (targetType === "project") {
    const project = await findProject(dataSource, tenantId, targetId);
    return project && project.id === projectId
      ? { ok: true as const }
      : { ok: false as const, error: "knowledge_action_target_not_found" };
  }
  if (targetType === "task") {
    if (!dataSource.findTaskById) {
      return { ok: false as const, status: 501 as const, error: "knowledge_not_configured" };
    }
    const task = await dataSource.findTaskById(tenantId, targetId);
    return task && task.projectId === projectId && !task.archivedAt
      ? { ok: true as const }
      : { ok: false as const, error: "knowledge_action_target_not_found" };
  }
  if (targetType === "opportunity") {
    if (!dataSource.findOpportunityById) {
      return { ok: false as const, status: 501 as const, error: "knowledge_not_configured" };
    }
    const opportunity = await dataSource.findOpportunityById(tenantId, targetId);
    return opportunity
      ? { ok: true as const }
      : { ok: false as const, error: "knowledge_action_target_not_found" };
  }
  if (!dataSource.listCorrectiveActions) {
    return { ok: false as const, status: 501 as const, error: "knowledge_not_configured" };
  }
  const correctiveActions = await dataSource.listCorrectiveActions(tenantId, projectId);
  return correctiveActions.some((action) => action.id === targetId)
    ? { ok: true as const }
    : { ok: false as const, error: "knowledge_action_target_not_found" };
}

async function validateMeetingLink(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  projectId: string,
  meetingId: string | null
) {
  if (!meetingId) return { ok: true as const };
  if (!dataSource.findProjectMeeting) {
    return { ok: false as const, status: 501 as const, error: "knowledge_not_configured" };
  }
  const meeting = await dataSource.findProjectMeeting({ tenantId, projectId, meetingId });
  return meeting ? { ok: true as const } : { ok: false as const, error: "knowledge_meeting_not_found" };
}

async function validateTenantUser(dataSource: ApiTenantDataSource, tenantId: string, userId: string) {
  const users = (await dataSource.listUsersByTenantId?.(tenantId)) ?? [];
  return users.some((user) => user.id === userId)
    ? { ok: true as const }
    : { ok: false as const, error: "tenant_user_not_found" };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requireMethod<T extends (...args: never[]) => unknown>(method: T | undefined): T {
  if (!method) throw new Error("knowledge_not_configured");
  return method;
}

function knowledgeErrorStatus(result: { ok: false; status?: 400 | 501 }): 400 | 501 {
  return result.status ?? 400;
}

function isKnowledgeVersionConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message : "";
  const constraint = typeof record.constraint === "string"
    ? record.constraint
    : typeof record.constraint_name === "string"
      ? record.constraint_name
      : "";
  if (
    record.code === "23505" &&
    (
      constraint === "knowledge_document_versions_document_number_uidx" ||
      message.includes("knowledge_document_versions_document_number_uidx")
    )
  ) {
    return true;
  }
  return isKnowledgeVersionConflict(record.cause);
}

function knowledgeAudit(input: {
  actionType: string;
  actor: TenantUser;
  projectId: string;
  commandInput: Record<string, unknown>;
  permissionResult: Record<string, unknown>;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  executionResult?: Record<string, unknown>;
}): ManagementAuditEventInput {
  return {
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: input.actionType,
    sourceWorkflow: "knowledge",
    sourceEntity: { type: "Project", id: input.projectId },
    commandInput: input.commandInput,
    beforeState: input.beforeState ?? null,
    afterState: input.afterState ?? null,
    permissionResult: input.permissionResult,
    ...(input.executionResult ? { executionResult: input.executionResult } : {})
  };
}

function safeDocumentInput(document: KnowledgeDocument): Record<string, unknown> {
  return {
    documentId: document.id,
    projectId: document.projectId,
    title: document.title,
    documentType: document.documentType,
    sourceMeetingId: document.sourceMeetingId,
    approvalStatus: document.approvalStatus
  };
}

function safeDecisionInput(decision: DecisionLogEntry): Record<string, unknown> {
  return {
    decisionId: decision.id,
    projectId: decision.projectId,
    title: decision.title,
    status: decision.status,
    sourceMeetingId: decision.sourceMeetingId,
    documentId: decision.documentId,
    supersedesDecisionId: decision.supersedesDecisionId
  };
}

function safeActionItemInput(actionItem: KnowledgeActionItem): Record<string, unknown> {
  return {
    actionItemId: actionItem.id,
    projectId: actionItem.projectId,
    title: actionItem.title,
    ownerUserId: actionItem.ownerUserId,
    dueDate: actionItem.dueDate,
    status: actionItem.status,
    sourceMeetingId: actionItem.sourceMeetingId,
    documentId: actionItem.documentId,
    decisionId: actionItem.decisionId
  };
}

function serializeDocument(document: KnowledgeDocument) {
  return {
    ...document,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    archivedAt: document.archivedAt?.toISOString() ?? null
  };
}

function serializeVersion(version: KnowledgeDocumentVersion) {
  return {
    ...version,
    createdAt: version.createdAt.toISOString()
  };
}

function serializeDecision(decision: DecisionLogEntry) {
  return {
    ...decision,
    createdAt: decision.createdAt.toISOString(),
    updatedAt: decision.updatedAt.toISOString(),
    archivedAt: decision.archivedAt?.toISOString() ?? null
  };
}

function serializeActionItem(actionItem: KnowledgeActionItem) {
  return {
    ...actionItem,
    createdAt: actionItem.createdAt.toISOString(),
    updatedAt: actionItem.updatedAt.toISOString(),
    archivedAt: actionItem.archivedAt?.toISOString() ?? null
  };
}
