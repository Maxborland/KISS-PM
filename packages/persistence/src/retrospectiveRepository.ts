import { and, asc, desc, eq, or } from "drizzle-orm";

import type {
  ProjectClosureSnapshot,
  RetrospectiveLesson,
  RetrospectiveReadModel,
  TemplateImprovementAction
} from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import {
  projectClosureSnapshots,
  projects,
  retrospectiveLessons,
  templateImprovementActions
} from "./schema";

export type ProjectClosureSnapshotInput = Omit<
  ProjectClosureSnapshot,
  "closedAt"
> & {
  closedAt: Date;
};

export type RetrospectiveLessonInput = Omit<RetrospectiveLesson, "createdAt"> & {
  createdAt?: Date;
};

export type TemplateImprovementActionInput = Omit<
  TemplateImprovementAction,
  "createdAt" | "appliedAt"
> & {
  createdAt?: Date;
  appliedAt?: Date | null;
};

export type RetrospectiveRepository = {
  getRetrospectiveReadModel(
    tenantId: string,
    projectId: string
  ): Promise<RetrospectiveReadModel>;
  closeProject(input: {
    snapshot: ProjectClosureSnapshotInput;
    lessons: RetrospectiveLessonInput[];
    templateImprovementActions: TemplateImprovementActionInput[];
  }): Promise<RetrospectiveReadModel>;
  addRetrospectiveLesson(input: RetrospectiveLessonInput): Promise<RetrospectiveLesson>;
  applyTemplateImprovementAction(input: {
    tenantId: string;
    projectId: string;
    actionId: string;
    actorUserId: string;
    auditEventId: string;
    appliedAt: Date;
  }): Promise<TemplateImprovementAction | undefined>;
  listTemplateImprovementActions(input: {
    tenantId: string;
    templateId: string;
    status?: TemplateImprovementAction["status"];
  }): Promise<TemplateImprovementAction[]>;
};

export function createRetrospectiveRepository(
  db: KissPmDatabase
): RetrospectiveRepository {
  return {
    async getRetrospectiveReadModel(tenantId, projectId) {
      const [snapshotRow, lessonRows, actionRows] = await Promise.all([
        db
          .select()
          .from(projectClosureSnapshots)
          .where(
            and(
              eq(projectClosureSnapshots.tenantId, tenantId),
              eq(projectClosureSnapshots.projectId, projectId)
            )
          )
          .limit(1),
        db
          .select()
          .from(retrospectiveLessons)
          .where(
            and(
              eq(retrospectiveLessons.tenantId, tenantId),
              eq(retrospectiveLessons.projectId, projectId)
            )
          )
          .orderBy(asc(retrospectiveLessons.createdAt), asc(retrospectiveLessons.id)),
        db
          .select()
          .from(templateImprovementActions)
          .where(
            and(
              eq(templateImprovementActions.tenantId, tenantId),
              eq(templateImprovementActions.projectId, projectId)
            )
          )
          .orderBy(desc(templateImprovementActions.createdAt), asc(templateImprovementActions.id))
      ]);
      return {
        snapshot: snapshotRow[0] ? mapClosureSnapshot(snapshotRow[0]) : null,
        lessons: lessonRows.map(mapRetrospectiveLesson),
        templateImprovementActions: actionRows.map(mapTemplateImprovementAction)
      };
    },

    async closeProject(input) {
      return db.transaction(async (transaction) => {
        const { snapshot } = input;
        const [project] = await transaction
          .select()
          .from(projects)
          .where(
            and(eq(projects.tenantId, snapshot.tenantId), eq(projects.id, snapshot.projectId))
          )
          .limit(1);
        if (!project) throw new Error("project_not_found");
        if (project.status !== "active" && project.status !== "paused") {
          throw new Error("project_not_closable");
        }

        const [updatedProject] = await transaction
          .update(projects)
          .set({ status: "closed", closedAt: snapshot.closedAt })
          .where(
            and(
              eq(projects.tenantId, snapshot.tenantId),
              eq(projects.id, snapshot.projectId),
              or(eq(projects.status, "active"), eq(projects.status, "paused"))
            )
          )
          .returning();
        if (!updatedProject) throw new Error("project_not_closable");

        const [snapshotRow] = await transaction
          .insert(projectClosureSnapshots)
          .values({
            id: snapshot.id,
            tenantId: snapshot.tenantId,
            projectId: snapshot.projectId,
            projectStatusBefore: snapshot.projectStatusBefore,
            planVersion: snapshot.planVersion,
            snapshotPayload: snapshot.snapshotPayload,
            planFactSummary: snapshot.planFactSummary,
            closedByUserId: snapshot.closedByUserId,
            closedAt: snapshot.closedAt,
            closeReason: snapshot.closeReason,
            auditEventId: snapshot.auditEventId
          })
          .returning();
        if (!snapshotRow) throw new Error("Project closure snapshot insert returned no row");

        if (input.lessons.length > 0) {
          await transaction.insert(retrospectiveLessons).values(
            input.lessons.map((lesson) => ({
              ...lesson,
              createdAt: lesson.createdAt ?? snapshot.closedAt
            }))
          );
        }
        if (input.templateImprovementActions.length > 0) {
          await transaction.insert(templateImprovementActions).values(
            input.templateImprovementActions.map((action) => ({
              ...action,
              createdAt: action.createdAt ?? snapshot.closedAt,
              appliedAt: action.appliedAt ?? null
            }))
          );
        }

        const lessonRows = await transaction
          .select()
          .from(retrospectiveLessons)
          .where(
            and(
              eq(retrospectiveLessons.tenantId, snapshot.tenantId),
              eq(retrospectiveLessons.projectId, snapshot.projectId)
            )
          )
          .orderBy(asc(retrospectiveLessons.createdAt), asc(retrospectiveLessons.id));
        const actionRows = await transaction
          .select()
          .from(templateImprovementActions)
          .where(
            and(
              eq(templateImprovementActions.tenantId, snapshot.tenantId),
              eq(templateImprovementActions.projectId, snapshot.projectId)
            )
          )
          .orderBy(desc(templateImprovementActions.createdAt), asc(templateImprovementActions.id));
        return {
          snapshot: mapClosureSnapshot(snapshotRow),
          lessons: lessonRows.map(mapRetrospectiveLesson),
          templateImprovementActions: actionRows.map(mapTemplateImprovementAction)
        };
      });
    },

    async addRetrospectiveLesson(input) {
      const [snapshot] = await db
        .select({ id: projectClosureSnapshots.id })
        .from(projectClosureSnapshots)
        .where(
          and(
            eq(projectClosureSnapshots.tenantId, input.tenantId),
            eq(projectClosureSnapshots.projectId, input.projectId),
            eq(projectClosureSnapshots.id, input.snapshotId)
          )
        )
        .limit(1);
      if (!snapshot) throw new Error("closure_snapshot_not_found");

      const [row] = await db
        .insert(retrospectiveLessons)
        .values({
          ...input,
          createdAt: input.createdAt ?? new Date()
        })
        .returning();
      if (!row) throw new Error("Retrospective lesson insert returned no row");
      return mapRetrospectiveLesson(row);
    },

    async applyTemplateImprovementAction(input) {
      const [row] = await db
        .update(templateImprovementActions)
        .set({
          status: "applied",
          appliedByUserId: input.actorUserId,
          appliedAt: input.appliedAt,
          auditEventId: input.auditEventId
        })
        .where(
          and(
            eq(templateImprovementActions.tenantId, input.tenantId),
            eq(templateImprovementActions.projectId, input.projectId),
            eq(templateImprovementActions.id, input.actionId),
            eq(templateImprovementActions.status, "proposed")
          )
        )
        .returning();
      return row ? mapTemplateImprovementAction(row) : undefined;
    },

    async listTemplateImprovementActions(input) {
      const predicates = [
        eq(templateImprovementActions.tenantId, input.tenantId),
        eq(templateImprovementActions.templateId, input.templateId)
      ];
      if (input.status) {
        predicates.push(eq(templateImprovementActions.status, input.status));
      }
      const rows = await db
        .select()
        .from(templateImprovementActions)
        .where(and(...predicates))
        .orderBy(desc(templateImprovementActions.appliedAt), desc(templateImprovementActions.createdAt));
      return rows.map(mapTemplateImprovementAction);
    }
  };
}

function mapClosureSnapshot(
  row: typeof projectClosureSnapshots.$inferSelect
): ProjectClosureSnapshot {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    projectStatusBefore: row.projectStatusBefore,
    planVersion: row.planVersion,
    snapshotPayload: row.snapshotPayload,
    planFactSummary: row.planFactSummary as ProjectClosureSnapshot["planFactSummary"],
    closedByUserId: row.closedByUserId,
    closedAt: row.closedAt.toISOString(),
    closeReason: row.closeReason,
    auditEventId: row.auditEventId
  };
}

function mapRetrospectiveLesson(
  row: typeof retrospectiveLessons.$inferSelect
): RetrospectiveLesson {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    snapshotId: row.snapshotId,
    category: row.category as RetrospectiveLesson["category"],
    title: row.title,
    body: row.body,
    impact: row.impact as RetrospectiveLesson["impact"],
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString()
  };
}

function mapTemplateImprovementAction(
  row: typeof templateImprovementActions.$inferSelect
): TemplateImprovementAction {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    snapshotId: row.snapshotId,
    templateId: row.templateId,
    status: row.status as TemplateImprovementAction["status"],
    title: row.title,
    description: row.description,
    impact: row.impact as TemplateImprovementAction["impact"],
    createdByUserId: row.createdByUserId,
    appliedByUserId: row.appliedByUserId,
    createdAt: row.createdAt.toISOString(),
    appliedAt: row.appliedAt?.toISOString() ?? null,
    auditEventId: row.auditEventId
  };
}
