import { delay, http, HttpResponse, type HttpHandler } from "msw";

import { getFixtureBundle } from "../src/lib/mock-data/fixture-bundle";
import { getActiveStorybookScenario } from "../src/lib/mock-data/storybook-scenario-runtime";
import { scenarioHttpBehavior } from "../src/lib/mock-data/scenarios";

const DEFAULT_PROJECT_ID = "PRJ-2026-014";

async function respond<T extends Record<string, unknown>>(
  body: T
): Promise<Response> {
  const behavior = scenarioHttpBehavior(getActiveStorybookScenario());
  switch (behavior.kind) {
    case "loading":
      await delay(behavior.delayMs);
      return HttpResponse.json(body);
    case "error":
      return HttpResponse.json(
        { error: "internal_error", message: behavior.message },
        { status: 500 }
      );
    case "forbidden":
      return HttpResponse.json({ error: behavior.reason }, { status: 403 });
    default:
      return HttpResponse.json(body);
  }
}

function bundle() {
  return getFixtureBundle(getActiveStorybookScenario());
}

export function createStorybookMswHandlers(): HttpHandler[] {
  return [
    http.get("/api/workspace/opportunities", async () =>
      respond({ opportunities: bundle().opportunities })
    ),
    http.get("/api/workspace/projects", async () =>
      respond({ projects: bundle().projects })
    ),
    http.get("/api/workspace/projects/:projectId/tasks", async ({ params }) => {
      const projectId = String(params.projectId);
      return respond({
        tasks: bundle().tasks.filter((task) => task.projectId === projectId)
      });
    }),
    http.get("/api/workspace/projects/:projectId/control/read-model", async ({ params }) => {
      const projectId = String(params.projectId);
      const fixtures = bundle();
      return respond({
        definitions: fixtures.kpiDefinitions,
        evaluations: fixtures.kpiEvaluations.filter((item) => item.projectId === projectId),
        signals: fixtures.controlSignals.filter((item) => item.projectId === projectId),
        correctiveActions: fixtures.correctiveActions.filter(
          (item) => item.projectId === projectId
        ),
        actionExecutions: fixtures.actionExecutions.filter(
          (item) => item.projectId === projectId
        ),
        auditEvents: fixtures.auditEvents
      });
    }),
    http.get("/api/workspace/clients", async () => respond({ clients: bundle().clients })),
    http.get("/api/workspace/contacts", async () => respond({ contacts: bundle().contacts })),
    http.get("/api/workspace/products", async () => respond({ products: bundle().products })),
    http.get("/api/workspace/deal-stages", async () =>
      respond({ dealStages: bundle().dealStages })
    ),
    http.get("/api/workspace/project-types", async () =>
      respond({ projectTypes: bundle().projectTypes })
    ),
    http.get("/api/workspace/users", async () =>
      respond({ users: bundle().workspaceUsers })
    ),
    http.get("/api/workspace/positions", async () => respond({ positions: bundle().positions })),
    http.get("/api/workspace/task-statuses", async () =>
      respond({ taskStatuses: bundle().taskStatuses })
    ),
    http.get("/api/workspace/config/custom-fields", async () =>
      respond({ customFields: bundle().customFields })
    ),
    http.get("/api/workspace/config/project-templates", async () =>
      respond({ projectTemplates: bundle().projectTemplates })
    ),
    http.get("/api/tenant/current/kpi-definitions", async () =>
      respond({ definitions: bundle().kpiDefinitions })
    ),
    http.get("/api/tenant/current/access-profiles", async () =>
      respond({ accessProfiles: bundle().accessProfiles })
    ),
    http.get("/api/tenant/current/org-structure", async () =>
      respond({ orgStructure: bundle().orgStructure })
    ),
    http.get("/api/tenant/current/audit-events", async () =>
      respond({ auditEvents: bundle().auditEvents })
    ),
    http.get("/api/tenant/current/production-calendar", async () =>
      respond(bundle().productionCalendar)
    ),
    http.get("/api/tenant/current/absences", async () => respond({ absences: bundle().absences })),
    http.get("/api/tenant/current/scheduled-tasks", async ({ request }) => {
      const url = new URL(request.url);
      const assigneeUserId = url.searchParams.get("assigneeUserId");
      const fromDate = url.searchParams.get("fromDate");
      const toDate = url.searchParams.get("toDate");
      if (!assigneeUserId || !fromDate || !toDate) {
        return HttpResponse.json({ error: "scheduled_tasks_invalid" }, { status: 400 });
      }
      return respond({ tasks: bundle().scheduledTasks });
    }),
    http.get(`/api/workspace/projects/${DEFAULT_PROJECT_ID}`, async () => {
      const fixtures = bundle();
      const project =
        fixtures.projects.find((item) => item.id === DEFAULT_PROJECT_ID) ??
        fixtures.projects[0];
      if (!project) {
        return HttpResponse.json({ error: "project_not_found" }, { status: 404 });
      }
      return respond({
        project,
        tasks: fixtures.tasks.filter((task) => task.projectId === project.id)
      });
    })
  ];
}

export const storybookMswHandlers = createStorybookMswHandlers();
