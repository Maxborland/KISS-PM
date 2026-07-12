import { expect, test, type Page } from "@playwright/test";

type Assignment = {
  id: string;
  taskId: string;
  resourceId: string;
  role: string;
  unitsPermille: number;
  workMinutes: number | null;
};

type Overload = {
  granularity: string;
  resourceId: string;
  date: string;
  overloadMinutes: number;
  taskIds: string[];
};

type ReadModel = {
  authored: { assignments: Assignment[] };
  resourceLoad: { overloads: Overload[]; acceptedOverloads?: string[] };
  planVersion: number;
};

type ScenarioTarget = {
  type: "resource_overload";
  resourceId: string;
  date: string;
  overloadMinutes: number;
  taskIds: string[];
};

type AssignmentUpsert = {
  type: "assignment.upsert";
  payload: Assignment;
};

type AssignmentDelete = {
  type: "assignment.delete";
  payload: { assignmentId: string };
};

type ScenarioProposal = {
  id: string;
  profile: "aggressive" | "balanced" | "resilient";
  conflictEffect: "accepted" | "reduced" | "removed";
  planDelta: { commands: Array<{ type: string; payload: Record<string, unknown> }> };
};

type ScenarioPreviewBody = {
  proposals: ScenarioProposal[];
  planVersion: number;
  expiresAt: string;
};

const ADMIN = { email: "admin@kiss-pm.local", password: "admin12345" };
const PLAN_READER = {
  email: "plan-reader-no-resources@kiss-pm.local",
  password: "reader12345"
};

const PROFILE_LABEL = {
  aggressive: "Агрессивный",
  balanced: "Балансированный",
  resilient: "Устойчивый"
} as const;

test.describe("Projects scenarios write flow", () => {
  test("ADMIN previews and compares before apply, persists after reload, then restores assignments", async ({
    page
  }, testInfo) => {
    test.setTimeout(90_000);
    testInfo.annotations.push({
      type: "cleanup-gap",
      description:
        "Compensation restores scenario-touched assignments and overload state; plan version, audit events, and the applied scenario-run remain as append-only history."
    });

    const { projectId, readModel: before } = await loginAndFindScenarioProject(page);
    let cleanupProposal: ScenarioProposal | null = null;
    let previewTarget: ScenarioTarget | null = null;
    let scenarioApplyRequests = 0;

    page.on("request", (request) => {
      if (isScenarioApplyPath(new URL(request.url()).pathname, projectId)) {
        scenarioApplyRequests += 1;
      }
    });

    try {
      const previewResponsePromise = waitForScenarioPreview(page, projectId);
      await page.goto(`/projects/${encodeURIComponent(projectId)}/scenarios`);
      await expect(
        page.getByRole("heading", { name: "Сценарии планирования", exact: true })
      ).toBeVisible();

      const previewResponse = await previewResponsePromise;
      expect(previewResponse.status()).toBe(200);
      const previewEnvelope = previewResponse.request().postDataJSON() as {
        target: ScenarioTarget;
        clientPlanVersion: number;
      };
      const previewBody = (await previewResponse.json()) as ScenarioPreviewBody;
      previewTarget = previewEnvelope.target;

      expect(previewEnvelope.clientPlanVersion).toBe(before.planVersion);
      expect(previewBody.planVersion).toBe(before.planVersion);
      expect(previewBody.proposals.length).toBeGreaterThan(0);
      expect(scenarioApplyRequests).toBe(0);

      const afterPreview = await getReadModel(page, projectId);
      expect(afterPreview.planVersion).toBe(before.planVersion);
      expect(sortedAssignments(afterPreview)).toEqual(sortedAssignments(before));
      expect(findTargetOverload(afterPreview, previewTarget)).toEqual(
        findTargetOverload(before, previewTarget)
      );

      cleanupProposal = chooseCleanupSafeProposal(previewBody.proposals, before);
      const proposalIndex = previewBody.proposals.findIndex(
        (proposal) => proposal.id === cleanupProposal!.id
      );
      const profileLabel = PROFILE_LABEL[cleanupProposal.profile];

      await page
        .getByRole("button", { name: "Сравнить", exact: true })
        .nth(proposalIndex)
        .click();
      await expect(
        page.getByText("Сравнение · предпросмотр (ничего не сохранено)", {
          exact: true
        })
      ).toBeVisible();
      await expect(
        page.getByText(`Сейчас · план v${before.planVersion}`, { exact: true })
      ).toBeVisible();
      await expect(
        page.getByText(`${profileLabel} · предпросмотр`, { exact: true })
      ).toBeVisible();
      await expect(
        page.getByText(`Изменения (${cleanupProposal.planDelta.commands.length})`, {
          exact: true
        })
      ).toBeVisible();

      const afterCompare = await getReadModel(page, projectId);
      expect(afterCompare.planVersion).toBe(before.planVersion);
      expect(sortedAssignments(afterCompare)).toEqual(sortedAssignments(before));
      expect(scenarioApplyRequests).toBe(0);

      const applyResponsePromise = waitForScenarioApply(
        page,
        projectId,
        cleanupProposal.id
      );
      await page
        .getByRole("button", { name: "Применить", exact: true })
        .nth(proposalIndex)
        .click();

      const applyResponse = await applyResponsePromise;
      expect(applyResponse.status()).toBe(200);
      expect(scenarioApplyRequests).toBe(1);
      const applyEnvelope = applyResponse.request().postDataJSON() as {
        clientPlanVersion: number;
      };
      const applyBody = (await applyResponse.json()) as {
        scenarioRunId: string;
        newPlanVersion: number;
      };
      expect(applyEnvelope.clientPlanVersion).toBe(before.planVersion);
      expect(applyBody.scenarioRunId).toBe(cleanupProposal.id);
      expect(applyBody.newPlanVersion).toBe(before.planVersion + 1);
      await expect(
        page.getByText(new RegExp(`Сценарий «${escapeRegExp(profileLabel)}» применён`))
      ).toBeVisible();

      const applied = await getReadModel(page, projectId);
      expect(applied.planVersion).toBe(applyBody.newPlanVersion);
      expectScenarioAssignmentsApplied(applied, cleanupProposal);

      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Сценарии планирования", exact: true })
      ).toBeVisible();
      await expect(
        page.getByText(`план v${applied.planVersion}`, { exact: true })
      ).toBeVisible();
      const afterReload = await getReadModel(page, projectId);
      expect(afterReload.planVersion).toBe(applied.planVersion);
      expectScenarioAssignmentsApplied(afterReload, cleanupProposal);

      const restored = await restoreScenarioAssignments(
        page,
        projectId,
        before,
        cleanupProposal
      );
      expectTouchedAssignmentsRestored(restored, before, cleanupProposal);
      expect(findTargetOverload(restored, previewTarget)).toEqual(
        findTargetOverload(before, previewTarget)
      );
      expect(restored.planVersion).toBeGreaterThan(applied.planVersion);

      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Сценарии планирования", exact: true })
      ).toBeVisible();
      await expect(
        page.getByText(`план v${restored.planVersion}`, { exact: true })
      ).toBeVisible();
      const restoredAfterReload = await getReadModel(page, projectId);
      expectTouchedAssignmentsRestored(
        restoredAfterReload,
        before,
        cleanupProposal
      );
      expect(findTargetOverload(restoredAfterReload, previewTarget)).toEqual(
        findTargetOverload(before, previewTarget)
      );
    } finally {
      if (cleanupProposal) {
        await restoreScenarioAssignments(page, projectId, before, cleanupProposal);
      }
    }
  });

  test("PLAN reader can preview scenarios but cannot apply them", async ({
    page
  }) => {
    test.setTimeout(60_000);
    const { projectId, readModel: before } = await loginAndFindScenarioProject(
      page,
      PLAN_READER
    );
    const target = firstAvailableTarget(before);
    let uiApplyRequests = 0;

    page.on("request", (request) => {
      if (isScenarioApplyPath(new URL(request.url()).pathname, projectId)) {
        uiApplyRequests += 1;
      }
    });

    await page.goto(`/projects/${encodeURIComponent(projectId)}/scenarios`);
    await expect(
      page.getByRole("heading", { name: "Сценарии планирования", exact: true })
    ).toBeVisible();
    await expect(page.locator('[data-testid^="scenario-card-"]')).toHaveCount(3);
    await expect(
      page.getByRole("button", { name: "Запросить заново", exact: true })
    ).toBeVisible();
    // «Сравнить» рендерится в каждой из трёх карточек — проверяем количество,
    // а не единственную видимость (strict mode падал на 3 элементах).
    await expect(
      page.getByRole("button", { name: "Сравнить", exact: true })
    ).toHaveCount(3);
    await expect(
      page.getByRole("button", { name: "Сравнить", exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Применить", exact: true })
    ).toHaveCount(0);
    expect(uiApplyRequests).toBe(0);

    const preview = await page.request.post(
      `/api/workspace/projects/${encodeURIComponent(
        projectId
      )}/planning/scenarios/preview`,
      {
        headers: mutationHeaders(page),
        data: { target, clientPlanVersion: before.planVersion }
      }
    );
    expect(preview.status()).toBe(200);

    const deniedApply = await page.request.post(
      `/api/workspace/projects/${encodeURIComponent(
        projectId
      )}/planning/scenarios/forbidden-probe/apply`,
      {
        headers: mutationHeaders(page),
        data: { clientPlanVersion: before.planVersion }
      }
    );
    expect(deniedApply.status()).toBe(403);

    const afterPreview = await getReadModel(page, projectId);
    expect(afterPreview.planVersion).toBe(before.planVersion);
    expect(sortedAssignments(afterPreview)).toEqual(sortedAssignments(before));
    expect(findTargetOverload(afterPreview, target)).toEqual(
      findTargetOverload(before, target)
    );
    expect(uiApplyRequests).toBe(0);

    await page.reload();
    await expect(page.locator('[data-testid^="scenario-card-"]')).toHaveCount(3);
    await expect(
      page.getByRole("button", { name: "Применить", exact: true })
    ).toHaveCount(0);
    const afterReload = await getReadModel(page, projectId);
    expect(afterReload.planVersion).toBe(before.planVersion);
    expect(sortedAssignments(afterReload)).toEqual(sortedAssignments(before));
    expect(findTargetOverload(afterReload, target)).toEqual(
      findTargetOverload(before, target)
    );
  });
});

async function loginAndFindScenarioProject(
  page: Page,
  credentials = ADMIN
) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Пароль", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL("**/dashboard");

  const response = await page.request.get("/api/workspace/projects");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { projects: Array<{ id: string }> };

  for (const project of body.projects) {
    const readModel = await getReadModel(page, project.id);
    const accepted = new Set(readModel.resourceLoad.acceptedOverloads ?? []);
    if (
      readModel.resourceLoad.overloads.some(
        (overload) =>
          overload.granularity === "day" &&
          !accepted.has(`${overload.resourceId}:${overload.date}`)
      )
    ) {
      return { projectId: project.id, readModel };
    }
  }

  throw new Error("scenario_fixture_unavailable:no_project_with_day_overload");
}

function firstAvailableTarget(readModel: ReadModel): ScenarioTarget {
  const accepted = new Set(readModel.resourceLoad.acceptedOverloads ?? []);
  const overload = readModel.resourceLoad.overloads.find(
    (candidate) =>
      candidate.granularity === "day" &&
      !accepted.has(`${candidate.resourceId}:${candidate.date}`)
  );
  if (!overload) {
    throw new Error("scenario_fixture_unavailable:no_day_overload");
  }
  return {
    type: "resource_overload",
    resourceId: overload.resourceId,
    date: overload.date,
    overloadMinutes: overload.overloadMinutes,
    taskIds: overload.taskIds
  };
}

async function getReadModel(page: Page, projectId: string): Promise<ReadModel> {
  const response = await page.request.get(
    `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/read-model`
  );
  expect(response.status()).toBe(200);
  return (await response.json()) as ReadModel;
}

function waitForScenarioPreview(page: Page, projectId: string) {
  const path = `/api/workspace/projects/${encodeURIComponent(
    projectId
  )}/planning/scenarios/preview`;
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === path
  );
}

function waitForScenarioApply(page: Page, projectId: string, scenarioId: string) {
  const path = `/api/workspace/projects/${encodeURIComponent(
    projectId
  )}/planning/scenarios/${encodeURIComponent(scenarioId)}/apply`;
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === path
  );
}

function isScenarioApplyPath(pathname: string, projectId: string) {
  const prefix = `/api/workspace/projects/${encodeURIComponent(
    projectId
  )}/planning/scenarios/`;
  return pathname.startsWith(prefix) && pathname.endsWith("/apply");
}

function chooseCleanupSafeProposal(
  proposals: ScenarioProposal[],
  before: ReadModel
) {
  const assignmentIds = new Set(
    before.authored.assignments.map((assignment) => assignment.id)
  );
  const preferredProfiles: ScenarioProposal["profile"][] = [
    "resilient",
    "balanced"
  ];

  for (const profile of preferredProfiles) {
    const proposal = proposals.find((candidate) => {
      if (candidate.profile !== profile || candidate.conflictEffect === "accepted") {
        return false;
      }
      const commands = candidate.planDelta.commands;
      if (
        commands.length === 0 ||
        !commands.every((command) => command.type === "assignment.upsert")
      ) {
        return false;
      }
      const ids = commands.map((command) => String(command.payload.id ?? ""));
      return (
        ids.every(Boolean) &&
        ids.some((id) => assignmentIds.has(id)) &&
        ids.some((id) => !assignmentIds.has(id))
      );
    });
    if (proposal) return proposal;
  }

  throw new Error(
    "scenario_fixture_unavailable:no_cleanup_safe_assignment_proposal"
  );
}

function expectScenarioAssignmentsApplied(
  readModel: ReadModel,
  proposal: ScenarioProposal
) {
  const byId = new Map(
    readModel.authored.assignments.map((assignment) => [assignment.id, assignment])
  );
  for (const command of proposal.planDelta.commands) {
    expect(command.type).toBe("assignment.upsert");
    const payload = command.payload as Assignment;
    expect(byId.get(payload.id)).toMatchObject(payload);
  }
}

async function restoreScenarioAssignments(
  page: Page,
  projectId: string,
  before: ReadModel,
  proposal: ScenarioProposal
): Promise<ReadModel> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await getReadModel(page, projectId);
    const commands = buildRestoreCommands(current, before, proposal);
    if (commands.length === 0) return current;

    const response = await page.request.post(
      `/api/workspace/projects/${encodeURIComponent(
        projectId
      )}/planning/apply-command-batch`,
      {
        headers: mutationHeaders(page),
        data: { commands, clientPlanVersion: current.planVersion }
      }
    );
    if (response.status() === 200) continue;
    if (response.status() !== 409) {
      throw new Error(
        `scenario_cleanup_failed:${projectId}:${response.status()}:${await response.text()}`
      );
    }
  }

  const current = await getReadModel(page, projectId);
  if (buildRestoreCommands(current, before, proposal).length === 0) return current;
  throw new Error(`scenario_cleanup_conflict:${projectId}`);
}

function buildRestoreCommands(
  current: ReadModel,
  before: ReadModel,
  proposal: ScenarioProposal
): Array<AssignmentUpsert | AssignmentDelete> {
  const beforeById = new Map(
    before.authored.assignments.map((assignment) => [assignment.id, assignment])
  );
  const currentById = new Map(
    current.authored.assignments.map((assignment) => [assignment.id, assignment])
  );
  const touchedIds = new Set(
    proposal.planDelta.commands.map((command) => String(command.payload.id ?? ""))
  );
  const commands: Array<AssignmentUpsert | AssignmentDelete> = [];

  for (const assignmentId of touchedIds) {
    const original = beforeById.get(assignmentId);
    const present = currentById.get(assignmentId);
    if (original && !sameAssignment(original, present)) {
      commands.push({ type: "assignment.upsert", payload: original });
    } else if (!original && present) {
      commands.push({
        type: "assignment.delete",
        payload: { assignmentId }
      });
    }
  }

  return commands;
}

function expectTouchedAssignmentsRestored(
  current: ReadModel,
  before: ReadModel,
  proposal: ScenarioProposal
) {
  const beforeById = new Map(
    before.authored.assignments.map((assignment) => [assignment.id, assignment])
  );
  const currentById = new Map(
    current.authored.assignments.map((assignment) => [assignment.id, assignment])
  );
  for (const command of proposal.planDelta.commands) {
    const assignmentId = String(command.payload.id ?? "");
    expect(currentById.get(assignmentId)).toEqual(beforeById.get(assignmentId));
  }
}

function sortedAssignments(readModel: ReadModel) {
  return [...readModel.authored.assignments].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
}

function findTargetOverload(readModel: ReadModel, target: ScenarioTarget) {
  return readModel.resourceLoad.overloads.find(
    (overload) =>
      overload.granularity === "day" &&
      overload.resourceId === target.resourceId &&
      overload.date === target.date
  );
}

function sameAssignment(left: Assignment, right: Assignment | undefined) {
  return Boolean(
    right &&
      left.id === right.id &&
      left.taskId === right.taskId &&
      left.resourceId === right.resourceId &&
      left.role === right.role &&
      left.unitsPermille === right.unitsPermille &&
      left.workMinutes === right.workMinutes
  );
}

function mutationHeaders(page: Page) {
  return {
    Origin: new URL(page.url()).origin,
    "x-kiss-pm-action": "same-origin"
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
