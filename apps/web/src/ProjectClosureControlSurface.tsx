import { useState } from "react";
import { getPhase9FixtureSeed } from "@kiss-pm/shared-test-fixtures";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CurrentTenantDto } from "./phase2ApiClient";
import type { ProjectClosureApiClient, ProjectClosureApplyResultDto, ProjectClosurePreviewDto } from "./projectClosureApiClient";

type ProjectClosureControlSurfaceProps = {
  apiClient: ProjectClosureApiClient;
  currentTenant: CurrentTenantDto;
  projectId: string;
  testUser: string;
};

const closureQueryKeys = {
  closure: (testUser: string, projectId: string) => ["project-closure", testUser, projectId] as const,
  audit: (testUser: string) => ["project-closure", testUser, "audit"] as const
};

function hasPermission(currentTenant: CurrentTenantDto, permissionKey: string): boolean {
  return currentTenant.permissions.includes(permissionKey);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Не удалось выполнить действие";
}

export function ProjectClosureControlSurface({
  apiClient,
  currentTenant,
  projectId,
  testUser
}: ProjectClosureControlSurfaceProps) {
  const queryClient = useQueryClient();
  const canReadClosure = hasPermission(currentTenant, "project.closure.read");
  const canCloseProject = hasPermission(currentTenant, "project.close");
  const [preview, setPreview] = useState<ProjectClosurePreviewDto | null>(null);
  const [result, setResult] = useState<ProjectClosureApplyResultDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const closureData = getPhase9FixtureSeed().tenantA.closureData;
  const closureQuery = useQuery({
    queryKey: closureQueryKeys.closure(testUser, projectId),
    queryFn: () => apiClient.getClosure(testUser, projectId),
    enabled: canReadClosure,
    retry: false
  });
  const auditQuery = useQuery({
    queryKey: closureQueryKeys.audit(testUser),
    queryFn: () => apiClient.getAudit(testUser),
    enabled: canReadClosure && result !== null,
    retry: false
  });
  const previewMutation = useMutation({
    mutationFn: () => apiClient.previewClosure(testUser, projectId, { closureData }),
    onSuccess(data) {
      setPreview(data.preview);
      setResult(null);
      setActionError(null);
    },
    onError(error) {
      setActionError(getErrorMessage(error));
    }
  });
  const applyMutation = useMutation({
    mutationFn: () => apiClient.applyClosure(testUser, projectId, { previewId: preview?.id }),
    async onSuccess(data) {
      setResult(data.result);
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: closureQueryKeys.closure(testUser, projectId) });
      await queryClient.invalidateQueries({ queryKey: closureQueryKeys.audit(testUser) });
    },
    onError(error) {
      setActionError(getErrorMessage(error));
    }
  });

  if (!canReadClosure) {
    return (
      <section className="closed-portfolio-surface" data-testid="project-closure-denied" id="project-closure-control">
        <div className="surface-heading">
          <div>
            <h2>Закрытие проекта</h2>
            <p>Нет доступа к закрытию проекта.</p>
          </div>
          <p className="status-pill">Нет доступа</p>
        </div>
      </section>
    );
  }

  const closure = closureQuery.data;
  const status =
    closureQuery.isFetching && closure === undefined ? "Загрузка закрытия проекта" : "Readback закрытия получен";

  return (
    <section className="closed-portfolio-surface" data-testid="project-closure-surface" id="project-closure-control">
      <div className="surface-heading">
        <div>
          <h2>Закрытие проекта</h2>
          <p>{projectId}</p>
        </div>
        <p className="status-pill" data-testid="project-closure-status">
          {status}
        </p>
      </div>

      {closureQuery.isLoading ? (
        <p className="phase2-panel" data-testid="project-closure-loading">
          Загрузка закрытия проекта
        </p>
      ) : null}

      {closureQuery.isError ? (
        <p className="readonly-notice" data-testid="project-closure-error">
          {getErrorMessage(closureQuery.error)}
        </p>
      ) : null}

      <div className="closed-portfolio-layout">
        <section className="phase2-panel">
          <h3>Готовность</h3>
          <p data-testid="project-closure-project-state">
            {closure?.project.id ?? projectId}: {closure?.project.lifecycleStatus ?? "нет readback"}
          </p>
          <div className="compact-list" data-testid="project-closure-checklist">
            {(closure?.checklist.requirements ?? []).map((requirement) => (
              <span key={requirement.key}>
                {requirement.label}: {requirement.required ? "обязательно" : "опционально"}
              </span>
            ))}
          </div>
          <div className="compact-list" data-testid="project-closure-blockers">
            {closure?.readiness.blockers.length ? closure.readiness.blockers.map((blocker) => <span key={blocker.code}>{blocker.code}</span>) : "Блокеров нет"}
          </div>
        </section>

        <section className="phase2-panel">
          <h3>Команда закрытия</h3>
          {!canCloseProject ? (
            <p className="readonly-notice" data-testid="project-closure-readonly">
              Нет права закрывать проект
            </p>
          ) : (
            <div className="compact-action-row">
              <button className="secondary-button" disabled={previewMutation.isPending} type="button" onClick={() => previewMutation.mutate()}>
                Предпросмотр закрытия
              </button>
              <button
                className="primary-button"
                disabled={preview === null || applyMutation.isPending}
                type="button"
                onClick={() => applyMutation.mutate()}
              >
                Закрыть проект
              </button>
            </div>
          )}
          {actionError ? (
            <p className="readonly-notice" data-testid="project-closure-action-error">
              {actionError}
            </p>
          ) : null}
        </section>
      </div>

      {preview ? (
        <div className="compact-list template-improvement-preview" data-testid="project-closure-preview">
          <strong>Без мутации</strong>
          <span>{preview.snapshotSummary.projectId}</span>
          <span>{preview.snapshotSummary.plannedWorkHours} ч</span>
          <span>{preview.snapshotSummary.lessonCount} урок</span>
        </div>
      ) : null}

      {result ? (
        <div className="compact-list template-improvement-result" data-testid="project-closure-result">
          <strong>{result.actionExecution.commandType}</strong>
          <span>{result.snapshotId}</span>
          <span>{result.actionExecution.auditEventIds.join(", ")}</span>
        </div>
      ) : null}

      {closure?.latestSnapshot ? (
        <div className="compact-list" data-testid="project-closure-latest-snapshot">
          <strong>Последний снимок</strong>
          <span>{closure.latestSnapshot.id}</span>
          <span>{closure.latestSnapshot.metrics.plannedWorkHours} ч</span>
        </div>
      ) : null}

      <div className="compact-list" data-testid="project-closure-audit">
        {(auditQuery.data?.actionExecutions ?? []).map((entry) => (
          <span key={entry.id}>
            {entry.commandType}: {entry.id}
          </span>
        ))}
        {(result?.actionExecution.auditEventIds ?? []).map((auditEventId) => (
          <span key={auditEventId}>{auditEventId}</span>
        ))}
      </div>
    </section>
  );
}
