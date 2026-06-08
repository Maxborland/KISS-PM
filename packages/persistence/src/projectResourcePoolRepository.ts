import { and, eq } from "drizzle-orm";

import type { TenantId, UserId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import { projectResourcePoolMembers } from "./schema";

export type ProjectResourcePoolRole = "project_manager" | "resource" | "observer";

export type ProjectResourcePoolMemberRecord = {
  tenantId: TenantId;
  projectId: string;
  userId: UserId;
  role: ProjectResourcePoolRole;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectResourcePoolMemberInput = {
  userId: UserId;
  role: ProjectResourcePoolRole;
};

export type ProjectResourcePoolRepository = {
  listProjectResourcePoolMembers(
    tenantId: TenantId,
    projectId: string
  ): Promise<ProjectResourcePoolMemberRecord[]>;
  replaceProjectResourcePoolMembers(input: {
    tenantId: TenantId;
    projectId: string;
    members: ProjectResourcePoolMemberInput[];
  }): Promise<ProjectResourcePoolMemberRecord[]>;
};

export function createProjectResourcePoolRepository(
  db: KissPmDatabase
): ProjectResourcePoolRepository {
  async function listProjectResourcePoolMembers(
    tenantId: TenantId,
    projectId: string,
    queryDb: KissPmDatabase = db
  ) {
    const rows = await queryDb
      .select()
      .from(projectResourcePoolMembers)
      .where(
        and(
          eq(projectResourcePoolMembers.tenantId, tenantId),
          eq(projectResourcePoolMembers.projectId, projectId)
        )
      )
      .orderBy(projectResourcePoolMembers.createdAt, projectResourcePoolMembers.userId);

    return rows.map(mapProjectResourcePoolMemberRecord);
  }

  return {
    listProjectResourcePoolMembers,
    async replaceProjectResourcePoolMembers(input) {
      const now = new Date();

      return db.transaction(async (transaction) => {
        const transactionDb = transaction as unknown as KissPmDatabase;
        await transactionDb
          .delete(projectResourcePoolMembers)
          .where(
            and(
              eq(projectResourcePoolMembers.tenantId, input.tenantId),
              eq(projectResourcePoolMembers.projectId, input.projectId)
            )
          );

        if (input.members.length > 0) {
          await transactionDb.insert(projectResourcePoolMembers).values(
            input.members.map((member) => ({
              tenantId: input.tenantId,
              projectId: input.projectId,
              userId: member.userId,
              role: member.role,
              createdAt: now,
              updatedAt: now
            }))
          );
        }

        return listProjectResourcePoolMembers(input.tenantId, input.projectId, transactionDb);
      });
    }
  };
}

function mapProjectResourcePoolMemberRecord(
  row: typeof projectResourcePoolMembers.$inferSelect
): ProjectResourcePoolMemberRecord {
  return {
    tenantId: row.tenantId,
    projectId: row.projectId,
    userId: row.userId,
    role: row.role as ProjectResourcePoolRole,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
