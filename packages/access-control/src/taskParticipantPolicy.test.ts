import { describe, expect, it } from "vitest";

import {
  TASK_PARTICIPANT_MANAGE_PERMISSION,
  TASK_PARTICIPANT_READ_PERMISSION,
  createAccessProfile,
  createScopeRule,
  createTaskParticipantPolicyTarget,
  evaluatePolicy
} from "./index";

const tenantId = "tenant-a";

describe("task participant policy integration", () => {
  it("evaluates own-scope task participant read access through the participant user relation", () => {
    const profile = createAccessProfile({
      id: "profile-task-participant-reader",
      tenantId,
      systemKey: "task_participant_reader",
      label: "Участник задач",
      permissions: [TASK_PARTICIPANT_READ_PERMISSION],
      scopeRules: [createScopeRule({ permissionKey: "task_participant.read", scope: "own" })],
      active: true,
      version: 1,
      updatedAt: "2026-05-15T07:38:00+07:00"
    });
    const target = createTaskParticipantPolicyTarget({
      tenantId,
      taskId: "task-1",
      projectId: "project-managed-1",
      userId: "executor-a"
    });

    expect(
      evaluatePolicy({
        actor: { tenantId, actorId: "executor-a" },
        profile,
        permissionKey: "task_participant.read",
        target
      })
    ).toMatchObject({ allowed: true, reasonCode: "allowed", scope: "own" });
    expect(
      evaluatePolicy({
        actor: { tenantId, actorId: "other-user-a" },
        profile,
        permissionKey: "task_participant.read",
        target
      })
    ).toMatchObject({ allowed: false, reasonCode: "owner_mismatch", scope: "own" });
  });

  it("evaluates project-scope participant management through project context", () => {
    const profile = createAccessProfile({
      id: "profile-task-participant-manager",
      tenantId,
      systemKey: "task_participant_manager",
      label: "Руководитель проекта",
      permissions: [TASK_PARTICIPANT_MANAGE_PERMISSION],
      scopeRules: [createScopeRule({ permissionKey: "task_participant.manage", scope: "project" })],
      active: true,
      version: 1,
      updatedAt: "2026-05-15T07:38:00+07:00"
    });
    const target = createTaskParticipantPolicyTarget({
      tenantId,
      taskId: "task-1",
      projectId: "project-managed-1",
      userId: "executor-a"
    });

    expect(
      evaluatePolicy({
        actor: { tenantId, actorId: "project-manager-a" },
        profile,
        permissionKey: "task_participant.manage",
        target,
        contextRefs: { projectIds: ["project-managed-1"] }
      })
    ).toMatchObject({ allowed: true, reasonCode: "allowed", scope: "project" });
    expect(
      evaluatePolicy({
        actor: { tenantId, actorId: "project-manager-a" },
        profile,
        permissionKey: "task_participant.manage",
        target,
        contextRefs: { projectIds: ["other-project"] }
      })
    ).toMatchObject({ allowed: false, reasonCode: "project_scope_mismatch", scope: "project" });
  });
});
