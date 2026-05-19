import {
  canManageWorkspaceConfig,
  canReadWorkspaceConfig,
  type AccessProfile
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";
import type {
  ApiTenantDataSource,
  ManagementAuditEventInput
} from "./apiTypes";
import {
  parseCustomFieldDefinitionBody,
  parseProjectTemplateBody
} from "./workspaceConfigParsers";
import { getStringField } from "./parseHelpers";

type WorkspaceConfigRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<void>;
};

export function registerWorkspaceConfigRoutes(
  app: Hono,
  deps: WorkspaceConfigRouteDeps
) {
  const {
    appendManagementAuditEvent,
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders,
    runDataSourceTransaction
  } = deps;

  app.get("/api/workspace/config/custom-fields", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listCustomFieldDefinitions) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadWorkspaceConfig({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({
      customFields: await dataSource.listCustomFieldDefinitions(actor.tenantId)
    });
  });

  app.post("/api/workspace/config/custom-fields", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.createCustomFieldDefinition ||
      !dataSource.listCustomFieldDefinitions ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageWorkspaceConfig({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const body = await context.req.json().catch(() => null);
    const parsed = parseCustomFieldDefinitionBody(body, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const existingFields = await dataSource.listCustomFieldDefinitions(actor.tenantId);
    if (existingFields.some((field) => field.id === parsed.value.id)) {
      return context.json({ error: "custom_field_id_taken" }, 409);
    }
    if (
      existingFields.some((field) => field.systemKey === parsed.value.systemKey)
    ) {
      return context.json({ error: "custom_field_system_key_taken" }, 409);
    }

    const customField = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createCustomFieldDefinition) {
        throw new Error("transactional_custom_field_create_not_configured");
      }

      const createdField =
        await transactionDataSource.createCustomFieldDefinition(parsed.value);
      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "workspace.custom_field.created",
          sourceWorkflow: "single_workspace_config",
          sourceEntity: {
            type: "CustomFieldDefinition",
            id: createdField.id
          },
          commandInput: parsed.value,
          beforeState: null,
          afterState: createdField,
          permissionResult: decision
        },
        transactionDataSource
      );

      return createdField;
    });

    return context.json({ customField }, 201);
  });

  app.patch("/api/workspace/config/custom-fields/:fieldId", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.updateCustomFieldDefinition ||
      !dataSource.listCustomFieldDefinitions ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageWorkspaceConfig({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const fieldId = context.req.param("fieldId");
    const existingFields = await dataSource.listCustomFieldDefinitions(actor.tenantId);
    const beforeState =
      existingFields.find((field) => field.id === fieldId) ?? null;
    if (!beforeState) return context.json({ error: "custom_field_not_found" }, 404);

    const body = await context.req.json().catch(() => null);
    const systemKeyInput = getStringField(body, "systemKey");
    if (systemKeyInput !== undefined && systemKeyInput !== beforeState.systemKey) {
      return context.json({ error: "system_key_immutable" }, 400);
    }
    const parsed = parseCustomFieldDefinitionBody(
      {
        ...(body && typeof body === "object" ? body : {}),
        systemKey: beforeState.systemKey
      },
      actor.tenantId,
      fieldId
    );
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (
      existingFields.some(
        (field) =>
          field.id !== fieldId && field.systemKey === parsed.value.systemKey
      )
    ) {
      return context.json({ error: "custom_field_system_key_taken" }, 409);
    }

    const customField = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updateCustomFieldDefinition) {
        throw new Error("transactional_custom_field_update_not_configured");
      }

      const updatedField =
        await transactionDataSource.updateCustomFieldDefinition(parsed.value);
      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "workspace.custom_field.updated",
          sourceWorkflow: "single_workspace_config",
          sourceEntity: {
            type: "CustomFieldDefinition",
            id: updatedField.id
          },
          commandInput: parsed.value,
          beforeState,
          afterState: updatedField,
          permissionResult: decision
        },
        transactionDataSource
      );

      return updatedField;
    });

    return context.json({ customField });
  });

  app.get("/api/workspace/config/project-templates", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listProjectTemplates) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadWorkspaceConfig({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({
      projectTemplates: await dataSource.listProjectTemplates(actor.tenantId)
    });
  });

  app.post("/api/workspace/config/project-templates", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.createProjectTemplate ||
      !dataSource.listProjectTemplates ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageWorkspaceConfig({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const body = await context.req.json().catch(() => null);
    const parsed = parseProjectTemplateBody(body, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const existingTemplates = await dataSource.listProjectTemplates(actor.tenantId);
    if (existingTemplates.some((template) => template.id === parsed.value.id)) {
      return context.json({ error: "project_template_id_taken" }, 409);
    }
    if (
      existingTemplates.some(
        (template) => template.systemKey === parsed.value.systemKey
      )
    ) {
      return context.json({ error: "project_template_system_key_taken" }, 409);
    }

    const projectTemplate = await runDataSourceTransaction(
      async (transactionDataSource) => {
        if (!transactionDataSource.createProjectTemplate) {
          throw new Error("transactional_project_template_create_not_configured");
        }

        const createdTemplate =
          await transactionDataSource.createProjectTemplate(parsed.value);
        await appendManagementAuditEvent(
          {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "workspace.project_template.created",
            sourceWorkflow: "single_workspace_config",
            sourceEntity: {
              type: "ProjectTemplate",
              id: createdTemplate.id
            },
            commandInput: parsed.value,
            beforeState: null,
            afterState: createdTemplate,
            permissionResult: decision
          },
          transactionDataSource
        );

        return createdTemplate;
      }
    );

    return context.json({ projectTemplate }, 201);
  });

  app.patch("/api/workspace/config/project-templates/:templateId", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.updateProjectTemplate ||
      !dataSource.listProjectTemplates ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageWorkspaceConfig({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const templateId = context.req.param("templateId");
    const existingTemplates = await dataSource.listProjectTemplates(actor.tenantId);
    const beforeState =
      existingTemplates.find((template) => template.id === templateId) ?? null;
    if (!beforeState) {
      return context.json({ error: "project_template_not_found" }, 404);
    }

    const body = await context.req.json().catch(() => null);
    const systemKeyInput = getStringField(body, "systemKey");
    if (systemKeyInput !== undefined && systemKeyInput !== beforeState.systemKey) {
      return context.json({ error: "system_key_immutable" }, 400);
    }
    const parsed = parseProjectTemplateBody(
      {
        ...(body && typeof body === "object" ? body : {}),
        systemKey: beforeState.systemKey
      },
      actor.tenantId,
      templateId
    );
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (
      existingTemplates.some(
        (template) =>
          template.id !== templateId &&
          template.systemKey === parsed.value.systemKey
      )
    ) {
      return context.json({ error: "project_template_system_key_taken" }, 409);
    }

    const projectTemplate = await runDataSourceTransaction(
      async (transactionDataSource) => {
        if (!transactionDataSource.updateProjectTemplate) {
          throw new Error("transactional_project_template_update_not_configured");
        }

        const updatedTemplate =
          await transactionDataSource.updateProjectTemplate(parsed.value);
        await appendManagementAuditEvent(
          {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "workspace.project_template.updated",
            sourceWorkflow: "single_workspace_config",
            sourceEntity: {
              type: "ProjectTemplate",
              id: updatedTemplate.id
            },
            commandInput: parsed.value,
            beforeState,
            afterState: updatedTemplate,
            permissionResult: decision
          },
          transactionDataSource
        );

        return updatedTemplate;
      }
    );

    return context.json({ projectTemplate });
  });
}
