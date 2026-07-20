/* ============================================================
   Клиент закрытия проекта (retrospectiveRoutes.ts):
   - GET  /api/workspace/projects/:id/closure            — статус + снимок закрытия + уроки
   - POST /api/workspace/projects/:id/closure/preview    — предпросмотр закрытия (план/факт)
   - POST /api/workspace/projects/:id/closure/close      — закрыть проект (причина + уроки)
   - POST /api/workspace/projects/:id/closure/lessons    — добавить урок к снимку
   - GET  /api/tenant/current/project-templates/:id/retrospective-insights — выводы шаблона (read)
   Транспорт — общий createRequestJson; fetchImpl инъектируется тестами.
   ============================================================ */

import type {
  ClosureLessonCategory,
  ClosureLessonImpact,
  ClosurePlanFactSummary,
  RetrospectiveLesson,
  TemplateImprovementAction
} from "@kiss-pm/domain";

import { createRequestJson } from "../../lib/domain-client";

// Проектная часть ответа GET closure (ProjectRecord после JSON-сериализации: Date → ISO-строки).
export type ClosureProjectView = {
  id: string;
  title: string;
  status: "draft" | "active" | "paused" | "closed" | "cancelled";
  templateId: string | null;
  closedAt: string | null;
};

// Снимок закрытия после JSON-сериализации (closedAt — ISO-строка).
export type ClosureSnapshotView = {
  id: string;
  projectId: string;
  projectStatusBefore: string;
  planVersion: number;
  planFactSummary: ClosurePlanFactSummary;
  closedByUserId: string;
  closedAt: string;
  closeReason: string;
  auditEventId: string | null;
};

export type ClosureReadState = {
  project: ClosureProjectView;
  snapshot: ClosureSnapshotView | null;
  lessons: RetrospectiveLesson[];
  templateImprovementActions: TemplateImprovementAction[];
};

export type ClosurePreviewResult = {
  canClose: boolean;
  projectStatus: string;
  planFactSummary: ClosurePlanFactSummary;
  proposedTemplateImprovement: TemplateImprovementAction | null;
};

export type ClosureLessonInput = {
  category: ClosureLessonCategory;
  title: string;
  body: string;
  impact: ClosureLessonImpact;
};

export type ClosureCloseResult = {
  projectId: string;
  snapshot: ClosureSnapshotView | null;
  lessons: RetrospectiveLesson[];
  templateImprovementActions: TemplateImprovementAction[];
  auditEventId: string | null;
};

export type TemplateInsights = {
  templateId: string;
  appliedImprovements: TemplateImprovementAction[];
  estimationLearning: {
    appliedActionCount: number;
    plannedWorkDeltaMinutes: number;
    plannedDurationDeltaDays: number;
  };
};

export type ClosureClient = {
  getClosure(projectId: string): Promise<ClosureReadState>;
  previewClosure(projectId: string): Promise<ClosurePreviewResult>;
  closeProject(
    projectId: string,
    input: { closeReason: string; lessons: ClosureLessonInput[] }
  ): Promise<ClosureCloseResult>;
  addLesson(
    projectId: string,
    lesson: ClosureLessonInput
  ): Promise<{ lesson: RetrospectiveLesson; auditEventId: string }>;
  applyTemplateImprovement(
    projectId: string,
    actionId: string
  ): Promise<{ action: TemplateImprovementAction; auditEventId: string }>;
  getTemplateInsights(templateId: string): Promise<TemplateInsights>;
};

export function createClosureClient(options?: { fetchImpl?: typeof fetch }): ClosureClient {
  const requestJson = createRequestJson({
    apiOrigin: "",
    credentials: "include",
    ...(options?.fetchImpl ? { fetchImpl: options.fetchImpl } : {})
  });
  const base = (projectId: string) =>
    `/api/workspace/projects/${encodeURIComponent(projectId)}/closure`;
  return {
    getClosure: (projectId) => requestJson<ClosureReadState>(base(projectId)),
    previewClosure: (projectId) =>
      requestJson<ClosurePreviewResult>(`${base(projectId)}/preview`, {
        method: "POST",
        body: JSON.stringify({})
      }),
    closeProject: (projectId, input) =>
      requestJson<ClosureCloseResult>(`${base(projectId)}/close`, {
        method: "POST",
        body: JSON.stringify(input)
      }),
    addLesson: (projectId, lesson) =>
      requestJson<{ lesson: RetrospectiveLesson; auditEventId: string }>(
        `${base(projectId)}/lessons`,
        { method: "POST", body: JSON.stringify(lesson) }
      ),
    // POST …/closure/template-improvement-actions/:id/apply — применить предложенное
    // улучшение шаблона (боевой retrospectiveRoutes; 409, если уже применено).
    applyTemplateImprovement: (projectId, actionId) =>
      requestJson<{ action: TemplateImprovementAction; auditEventId: string }>(
        `${base(projectId)}/template-improvement-actions/${encodeURIComponent(actionId)}/apply`,
        { method: "POST", body: JSON.stringify({}) }
      ),
    getTemplateInsights: (templateId) =>
      requestJson<TemplateInsights>(
        `/api/tenant/current/project-templates/${encodeURIComponent(templateId)}/retrospective-insights`
      )
  };
}
