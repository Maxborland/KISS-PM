import { sql } from "drizzle-orm";

import type { AccessProfile, Permission } from "@kiss-pm/access-control";
import type { Tenant, TenantUser } from "@kiss-pm/domain";

import { hashPassword } from "./auth";
import type { KissPmDatabase } from "./connection";
import {
  accessProfiles,
  clients,
  contacts,
  dealStages,
  pipelines,
  positions,
  products,
  projectTypes,
  stageTransitions,
  taskStatuses,
  tenantUsers,
  tenants,
  userCredentials
} from "./schema";

export type SeedAccessProfile = AccessProfile & {
  tenantId: string;
  name: string;
};

export type SeedPosition = {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
};

export type SeedClient = {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  status?: string;
};

export type SeedContact = {
  id: string;
  tenantId: string;
  clientId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  telegram?: string | null;
  role?: string | null;
  status?: string;
};

export type SeedProduct = {
  id: string;
  tenantId: string;
  name: string;
  sku?: string | null;
  type: "service" | "goods";
  unit: string;
  price: number;
  description?: string | null;
  status?: string;
};

export type SeedProjectType = {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  status?: string;
};

export type SeedDealStage = {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
  status?: string;
};

export type SeedTenantUser = TenantUser & {
  email: string;
  positionId?: string | null;
  phone?: string | null;
  telegram?: string | null;
  status?: string;
  theme?: string;
  accentColor?: string;
  password?: string;
};

export type SeedTenantDataset = {
  tenants: readonly Tenant[];
  accessProfiles: readonly SeedAccessProfile[];
  positions?: readonly SeedPosition[];
  clients?: readonly SeedClient[];
  contacts?: readonly SeedContact[];
  products?: readonly SeedProduct[];
  projectTypes?: readonly SeedProjectType[];
  dealStages?: readonly SeedDealStage[];
  users: readonly SeedTenantUser[];
};

export async function seedTenantDataset(
  db: KissPmDatabase,
  dataset: SeedTenantDataset,
  createdAt: Date = new Date()
): Promise<void> {
  await db.transaction(async (transaction) => {
    for (const tenant of dataset.tenants) {
      await transaction
        .insert(tenants)
        .values({
          id: tenant.id,
          name: tenant.name,
          createdAt
        })
        .onConflictDoUpdate({
          target: tenants.id,
          set: {
            name: sql`excluded.name`
          }
        });
      for (const status of createDefaultTaskStatuses(tenant.id, createdAt)) {
        await transaction
          .insert(taskStatuses)
          .values(status)
          .onConflictDoNothing();
      }
    }

    for (const profile of dataset.accessProfiles) {
      await transaction
        .insert(accessProfiles)
        .values({
          id: profile.id,
          tenantId: profile.tenantId,
          name: profile.name,
          permissions: [...profile.permissions],
          createdAt
        })
        .onConflictDoUpdate({
          target: [accessProfiles.tenantId, accessProfiles.id],
          set: {
            name: sql`excluded.name`,
            permissions: sql`excluded.permissions`
          }
        });
    }

    for (const position of dataset.positions ?? []) {
      await transaction
        .insert(positions)
        .values({
          id: position.id,
          tenantId: position.tenantId,
          name: position.name,
          description: position.description ?? null,
          createdAt
        })
        .onConflictDoUpdate({
          target: positions.id,
          set: {
            tenantId: sql`excluded.tenant_id`,
            name: sql`excluded.name`,
            description: sql`excluded.description`
          }
        });
    }

    for (const client of dataset.clients ?? []) {
      await transaction
        .insert(clients)
        .values({
          id: client.id,
          tenantId: client.tenantId,
          name: client.name,
          description: client.description ?? null,
          status: client.status ?? "active",
          createdAt,
          updatedAt: createdAt
        })
        .onConflictDoUpdate({
          target: [clients.tenantId, clients.id],
          set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            status: sql`excluded.status`,
            updatedAt: sql`excluded.updated_at`
          }
        });
    }

    for (const contact of dataset.contacts ?? []) {
      await transaction
        .insert(contacts)
        .values({
          id: contact.id,
          tenantId: contact.tenantId,
          clientId: contact.clientId,
          name: contact.name,
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          telegram: contact.telegram ?? null,
          role: contact.role ?? null,
          status: contact.status ?? "active",
          createdAt,
          updatedAt: createdAt
        })
        .onConflictDoUpdate({
          target: [contacts.tenantId, contacts.id],
          set: {
            clientId: sql`excluded.client_id`,
            name: sql`excluded.name`,
            email: sql`excluded.email`,
            phone: sql`excluded.phone`,
            telegram: sql`excluded.telegram`,
            role: sql`excluded.role`,
            status: sql`excluded.status`,
            updatedAt: sql`excluded.updated_at`
          }
        });
    }

    for (const product of dataset.products ?? []) {
      await transaction
        .insert(products)
        .values({
          id: product.id,
          tenantId: product.tenantId,
          name: product.name,
          sku: product.sku ?? null,
          type: product.type,
          unit: product.unit,
          price: product.price,
          description: product.description ?? null,
          status: product.status ?? "active",
          createdAt,
          updatedAt: createdAt
        })
        .onConflictDoUpdate({
          target: [products.tenantId, products.id],
          set: {
            name: sql`excluded.name`,
            sku: sql`excluded.sku`,
            type: sql`excluded.type`,
            unit: sql`excluded.unit`,
            price: sql`excluded.price`,
            description: sql`excluded.description`,
            status: sql`excluded.status`,
            updatedAt: sql`excluded.updated_at`
          }
        });
    }

    for (const projectType of dataset.projectTypes ?? []) {
      await transaction
        .insert(projectTypes)
        .values({
          id: projectType.id,
          tenantId: projectType.tenantId,
          name: projectType.name,
          description: projectType.description ?? null,
          status: projectType.status ?? "active",
          createdAt,
          updatedAt: createdAt
        })
        .onConflictDoUpdate({
          target: [projectTypes.tenantId, projectTypes.id],
          set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            status: sql`excluded.status`,
            updatedAt: sql`excluded.updated_at`
          }
        });
    }

    // Группируем стадии по тенанту, чтобы для каждого тенанта со стадиями
    // создать дефолтную воронку и привязать к ней стадии + цепочку переходов.
    const stagesByTenant = new Map<string, SeedDealStage[]>();
    for (const stage of dataset.dealStages ?? []) {
      const bucket = stagesByTenant.get(stage.tenantId) ?? [];
      bucket.push(stage);
      stagesByTenant.set(stage.tenantId, bucket);
    }

    for (const [tenantId, tenantStages] of stagesByTenant) {
      const pipelineId = `${tenantId}-pipeline-default`;

      await transaction
        .insert(pipelines)
        .values({
          id: pipelineId,
          tenantId,
          name: "Основная воронка",
          description: null,
          isDefault: true,
          sortOrder: 1,
          status: "active",
          createdAt,
          updatedAt: createdAt
        })
        .onConflictDoUpdate({
          target: [pipelines.tenantId, pipelines.id],
          set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            isDefault: sql`excluded.is_default`,
            sortOrder: sql`excluded.sort_order`,
            status: sql`excluded.status`,
            updatedAt: sql`excluded.updated_at`
          }
        });

      // Стадии в порядке воронки (по sortOrder).
      const orderedStages = [...tenantStages].sort(
        (left, right) => left.sortOrder - right.sortOrder
      );

      for (const stage of orderedStages) {
        await transaction
          .insert(dealStages)
          .values({
            id: stage.id,
            tenantId: stage.tenantId,
            pipelineId,
            name: stage.name,
            sortOrder: stage.sortOrder,
            status: stage.status ?? "active",
            createdAt,
            updatedAt: createdAt
          })
          .onConflictDoUpdate({
            target: [dealStages.tenantId, dealStages.id],
            set: {
              pipelineId: sql`excluded.pipeline_id`,
              name: sql`excluded.name`,
              sortOrder: sql`excluded.sort_order`,
              status: sql`excluded.status`,
              updatedAt: sql`excluded.updated_at`
            }
          });
      }

      // Линейная цепочка переходов stage[i] -> stage[i + 1].
      for (let index = 0; index < orderedStages.length - 1; index += 1) {
        const fromStage = orderedStages[index];
        const toStage = orderedStages[index + 1];
        if (!fromStage || !toStage) {
          continue;
        }
        const isFinalTransition = index === orderedStages.length - 2;

        await transaction
          .insert(stageTransitions)
          .values({
            id: `${pipelineId}-transition-${fromStage.id}-to-${toStage.id}`,
            tenantId,
            pipelineId,
            fromStageId: fromStage.id,
            toStageId: toStage.id,
            // Финальный переход (в выигрышную/последнюю стадию) защищён гвардом.
            requireFeasibilityOk: isFinalTransition,
            minProbability: isFinalTransition ? 50 : null,
            guardNote: isFinalTransition
              ? "Требуется пройденная проверка реализуемости и вероятность ≥ 50%"
              : null,
            createdAt,
            updatedAt: createdAt
          })
          .onConflictDoUpdate({
            target: [stageTransitions.tenantId, stageTransitions.id],
            set: {
              pipelineId: sql`excluded.pipeline_id`,
              fromStageId: sql`excluded.from_stage_id`,
              toStageId: sql`excluded.to_stage_id`,
              requireFeasibilityOk: sql`excluded.require_feasibility_ok`,
              minProbability: sql`excluded.min_probability`,
              guardNote: sql`excluded.guard_note`,
              updatedAt: sql`excluded.updated_at`
            }
          });
      }
    }

    for (const user of dataset.users) {
      await transaction
        .insert(tenantUsers)
        .values({
          id: user.id,
          tenantId: user.tenantId,
          accessProfileId: user.accessProfileId,
          positionId: user.positionId ?? null,
          email: user.email,
          name: user.name,
          phone: user.phone ?? null,
          telegram: user.telegram ?? null,
          status: user.status ?? "active",
          theme: user.theme ?? "light",
          accentColor: user.accentColor ?? "#0f766e",
          createdAt
        })
        .onConflictDoUpdate({
          target: tenantUsers.id,
          set: {
            tenantId: sql`excluded.tenant_id`,
            accessProfileId: sql`excluded.access_profile_id`,
            positionId: sql`excluded.position_id`,
            email: sql`excluded.email`,
            name: sql`excluded.name`,
            phone: sql`excluded.phone`,
            telegram: sql`excluded.telegram`,
            status: sql`excluded.status`,
            theme: sql`excluded.theme`,
            accentColor: sql`excluded.accent_color`
          }
        });

      if (user.password) {
        const password = hashPassword(user.password);

        await transaction
          .insert(userCredentials)
          .values({
            userId: user.id,
            tenantId: user.tenantId,
            email: user.email,
            passwordHash: password.passwordHash,
            passwordSalt: password.passwordSalt,
            createdAt
          })
          .onConflictDoUpdate({
            target: userCredentials.userId,
            set: {
              tenantId: sql`excluded.tenant_id`,
              email: sql`excluded.email`,
              passwordHash: sql`excluded.password_hash`,
              passwordSalt: sql`excluded.password_salt`
            }
          });
      }
    }
  });
}

export function createTenantAdminSeedProfile(input: {
  id: string;
  tenantId: string;
  name?: string;
}): SeedAccessProfile {
  const adminPermissions = [
    "tenant.users.read",
    "tenant.users.manage",
    "tenant.access_profiles.read",
    "tenant.access_profiles.manage",
    "tenant.positions.read",
    "tenant.positions.manage",
    "tenant.audit_events.read",
    "tenant.workspace_config.read",
    "tenant.workspace_config.manage",
    "tenant.absences.read",
    "tenant.absences.manage",
    "tenant.org_structure.read",
    "tenant.org_structure.manage",
    "tenant.clients.read",
    "tenant.clients.manage",
    "tenant.contacts.read",
    "tenant.contacts.manage",
    "tenant.products.read",
    "tenant.products.manage",
    "tenant.project_types.read",
    "tenant.project_types.manage",
    "tenant.deal_stages.read",
    "tenant.deal_stages.manage",
    "tenant.opportunities.read",
    "tenant.opportunities.manage",
    "tenant.projects.read",
    "tenant.projects.manage",
    "tenant.project_plan.read",
    "tenant.project_plan.manage",
    "tenant.project_baselines.manage",
    "tenant.project_resources.read",
    "tenant.project_resources.manage",
    "tenant.planning_scenarios.preview",
    "tenant.planning_scenarios.apply",
    "tenant.kpi_definitions.read",
    "tenant.kpi_definitions.manage",
    "tenant.control_signals.read",
    "tenant.control_signals.manage",
    "tenant.management_actions.execute",
    "tenant.corrective_actions.manage",
    "tenant.control_surfaces.read",
    "tenant.control_surfaces.manage",
    "tenant.control_surfaces.publish",
    "tenant.retrospectives.read",
    "tenant.retrospectives.manage",
    "tenant.template_improvements.apply",
    "tenant.communications.read",
    "tenant.communications.manage",
    "tenant.tasks.create",
    "tenant.tasks.edit",
    "tenant.tasks.delete",
    "tenant.task_statuses.manage",
    "tenant.project_activation.manage",
    "tenant.resource_feasibility.read",
    "profile.read",
    "profile.update",
    "workspace.theme.manage"
  ] satisfies Permission[];

  return {
    id: input.id,
    tenantId: input.tenantId,
    name: input.name ?? "Администратор",
    permissions: adminPermissions
  };
}

function createDefaultTaskStatuses(tenantId: string, createdAt: Date) {
  return [
    {
      id: "task-status-new",
      tenantId,
      name: "Новая",
      category: "new",
      sortOrder: 10,
      status: "active",
      isSystem: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "task-status-waiting",
      tenantId,
      name: "Ожидает",
      category: "waiting",
      sortOrder: 20,
      status: "active",
      isSystem: false,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "task-status-in-progress",
      tenantId,
      name: "В работе",
      category: "in_progress",
      sortOrder: 30,
      status: "active",
      isSystem: false,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "task-status-review",
      tenantId,
      name: "На контроле",
      category: "review",
      sortOrder: 40,
      status: "active",
      isSystem: false,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "task-status-done",
      tenantId,
      name: "Выполнено",
      category: "done",
      sortOrder: 50,
      status: "active",
      isSystem: true,
      createdAt,
      updatedAt: createdAt
    }
  ];
}
