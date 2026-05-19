import { and, eq } from "drizzle-orm";
import type { TenantId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import type {
  CustomFieldDefinitionInput,
  CustomFieldDefinitionRecord,
  ProjectTemplateInput,
  ProjectTemplateRecord
} from "./repositories";
import {
  mapCustomFieldDefinitionRecord,
  mapProjectTemplateRecord
} from "./repositoryMappers";
import { customFieldDefinitions, projectTemplates } from "./schema";

export type WorkspaceConfigRepository = {
  listCustomFieldDefinitions(
    tenantId: TenantId
  ): Promise<CustomFieldDefinitionRecord[]>;
  createCustomFieldDefinition(
    input: CustomFieldDefinitionInput
  ): Promise<CustomFieldDefinitionRecord>;
  updateCustomFieldDefinition(
    input: CustomFieldDefinitionInput
  ): Promise<CustomFieldDefinitionRecord>;
  listProjectTemplates(tenantId: TenantId): Promise<ProjectTemplateRecord[]>;
  createProjectTemplate(input: ProjectTemplateInput): Promise<ProjectTemplateRecord>;
  updateProjectTemplate(input: ProjectTemplateInput): Promise<ProjectTemplateRecord>;
};

export function createWorkspaceConfigRepository(
  db: KissPmDatabase
): WorkspaceConfigRepository {
  return {
    async listCustomFieldDefinitions(tenantId) {
      const rows = await db
        .select()
        .from(customFieldDefinitions)
        .where(eq(customFieldDefinitions.tenantId, tenantId))
        .orderBy(customFieldDefinitions.systemKey);

      return rows.map(mapCustomFieldDefinitionRecord);
    },
    async createCustomFieldDefinition(input) {
      const now = new Date();
      const [row] = await db
        .insert(customFieldDefinitions)
        .values({
          ...input,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      if (!row) {
        throw new Error("Custom field insert returned no row");
      }

      return mapCustomFieldDefinitionRecord(row);
    },
    async updateCustomFieldDefinition(input) {
      const [row] = await db
        .update(customFieldDefinitions)
        .set({
          tenantLabel: input.tenantLabel,
          targetEntity: input.targetEntity,
          fieldType: input.fieldType,
          required: input.required,
          status: input.status,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(customFieldDefinitions.tenantId, input.tenantId),
            eq(customFieldDefinitions.id, input.id)
          )
        )
        .returning();

      if (!row) {
        throw new Error("Custom field update returned no row");
      }

      return mapCustomFieldDefinitionRecord(row);
    },
    async listProjectTemplates(tenantId) {
      const rows = await db
        .select()
        .from(projectTemplates)
        .where(eq(projectTemplates.tenantId, tenantId))
        .orderBy(projectTemplates.systemKey);

      return rows.map(mapProjectTemplateRecord);
    },
    async createProjectTemplate(input) {
      const now = new Date();
      const [row] = await db
        .insert(projectTemplates)
        .values({
          ...input,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      if (!row) {
        throw new Error("Project template insert returned no row");
      }

      return mapProjectTemplateRecord(row);
    },
    async updateProjectTemplate(input) {
      const [row] = await db
        .update(projectTemplates)
        .set({
          tenantLabel: input.tenantLabel,
          description: input.description,
          status: input.status,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(projectTemplates.tenantId, input.tenantId),
            eq(projectTemplates.id, input.id)
          )
        )
        .returning();

      if (!row) {
        throw new Error("Project template update returned no row");
      }

      return mapProjectTemplateRecord(row);
    }
  };
}
