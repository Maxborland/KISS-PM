"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import type { PlanningPreviewResponse, PlanningReadModel } from "@kiss-pm/planning-client";
import { useMemo, useState } from "react";

import { PlanningSelect, PlanningSelectLabel } from "../../../components/ui/select";
import type { PlanningPermissions } from "../hooks/usePlanningPermissions";
import { CalendarPreviewSummary } from "./CalendarPreviewSummary";
import { IntegrationsPlaceholder } from "./IntegrationsPlaceholder";
import { readProjectCalendarId } from "../planningReadModelAccess";

const TENANT_DEFAULT_CALENDAR_ID = "tenant-default";

export function ProjectSettingsPane(props: {
  projectId: string;
  readModel: PlanningReadModel | undefined;
  permissions: PlanningPermissions;
  onPreviewCommand: (command: PlanningCommand) => Promise<PlanningPreviewResponse>;
}) {
  const calendarOptions = useMemo(
    () => [
      { value: TENANT_DEFAULT_CALENDAR_ID, label: "Календарь tenant по умолчанию" },
      { value: "calendar-project", label: "Календарь проекта" }
    ],
    []
  );

  const currentCalendarId = readProjectCalendarId(props.readModel) ?? TENANT_DEFAULT_CALENDAR_ID;
  const [pendingCalendarId, setPendingCalendarId] = useState<string>(currentCalendarId);
  const [preview, setPreview] = useState<PlanningPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = props.permissions.canManageProjectPlan;

  const handlePreview = async (calendarId: string) => {
    if (!canManage) return;
    setPendingCalendarId(calendarId);
    setPreviewError(null);
    setIsSubmitting(true);
    try {
      const response = await props.onPreviewCommand({
        type: "project.settings.update",
        payload: { calendarId }
      });
      setPreview(response);
    } catch (error) {
      setPreview(null);
      setPreviewError(error instanceof Error ? error.message : "preview_failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="planning-pane" data-testid="planning-settings-pane">
      <h2>Настройки проекта</h2>
      <p className="planning-pane__muted">Проект: {props.projectId}</p>
      <div className="planning-settings-form">
        <div>
          <PlanningSelectLabel>Календарь проекта</PlanningSelectLabel>
          <PlanningSelect
            aria-label="Календарь проекта"
            value={pendingCalendarId}
            options={calendarOptions}
            onChange={(value) => void handlePreview(value)}
          />
          {!canManage ? (
            <p className="planning-pane__muted" title="Нужно право tenant.project_plan.manage">
              Только чтение настроек.
            </p>
          ) : null}
          {isSubmitting ? <p className="planning-pane__muted">Рассчитываем превью...</p> : null}
          {previewError ? (
            <p className="planning-pane__alert" data-testid="project-settings-preview-error">
              Не удалось рассчитать превью: {previewError}
            </p>
          ) : null}
          <CalendarPreviewSummary preview={preview} />
        </div>
      </div>
      <IntegrationsPlaceholder />
    </section>
  );
}
