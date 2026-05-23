"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import type { PlanningPreviewResponse } from "@kiss-pm/planning-client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

const apiOrigin = process.env.NEXT_PUBLIC_KISS_PM_API_ORIGIN ?? "";

export type TaskCustomFieldDefinition = {
  id: string;
  systemKey: string;
  tenantLabel: string;
  targetEntity: string;
  fieldType: string;
  required: boolean;
  status: string;
};

export function CustomFieldDefinitionsPane(props: {
  selectedTaskId: string | null;
  taskCustomFields: Record<string, unknown>;
  canManage: boolean;
  onPreviewCommand: (command: PlanningCommand) => Promise<PlanningPreviewResponse>;
}) {
  const customFieldsQuery = useQuery({
    queryKey: ["workspace-custom-fields"],
    queryFn: fetchCustomFieldDefinitions
  });

  const taskFields = useMemo(
    () =>
      (customFieldsQuery.data ?? []).filter(
        (definition) => definition.targetEntity === "task" && definition.status === "active"
      ),
    [customFieldsQuery.data]
  );

  if (customFieldsQuery.isLoading) {
    return <p className="planning-pane__muted">Загружаем пользовательские поля…</p>;
  }

  if (taskFields.length === 0) {
    return (
      <p className="planning-pane__muted" data-testid="custom-fields-empty">
        Пользовательских полей для задач не настроено.
      </p>
    );
  }

  if (!props.selectedTaskId) {
    return (
      <p className="planning-pane__muted" data-testid="custom-fields-no-task">
        Выберите задачу, чтобы редактировать пользовательские поля.
      </p>
    );
  }

  return (
    <section className="custom-field-definitions" data-testid="custom-field-definitions">
      <h3>Пользовательские поля задачи</h3>
      <table>
        <thead>
          <tr>
            <th>Поле</th>
            <th>Тип</th>
            <th>Значение</th>
          </tr>
        </thead>
        <tbody>
          {taskFields.map((field) => (
            <CustomFieldRow
              key={field.id}
              field={field}
              taskId={props.selectedTaskId!}
              currentValue={props.taskCustomFields[field.systemKey] ?? null}
              canManage={props.canManage}
              onPreviewCommand={props.onPreviewCommand}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CustomFieldRow(props: {
  field: TaskCustomFieldDefinition;
  taskId: string;
  currentValue: unknown;
  canManage: boolean;
  onPreviewCommand: (command: PlanningCommand) => Promise<PlanningPreviewResponse>;
}) {
  const [draftValue, setDraftValue] = useState<string>(formatValueAsString(props.currentValue));
  const inputType = props.field.fieldType === "number" ? "number" : "text";

  const commit = async () => {
    if (!props.canManage) return;
    if (draftValue === formatValueAsString(props.currentValue)) return;
    const value =
      props.field.fieldType === "number" && draftValue.trim().length > 0
        ? Number(draftValue)
        : draftValue;
    await props.onPreviewCommand({
      type: "task.update_custom_field",
      payload: {
        taskId: props.taskId,
        fieldKey: props.field.systemKey,
        value
      }
    });
  };

  return (
    <tr>
      <td>{props.field.tenantLabel}</td>
      <td>{props.field.fieldType}</td>
      <td>
        <input
          className="planning-cell-input"
          type={inputType}
          value={draftValue}
          readOnly={!props.canManage}
          title={props.canManage ? undefined : "Нужно право tenant.project_plan.manage"}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={() => void commit()}
          data-testid={`custom-field-input-${props.field.systemKey}`}
        />
      </td>
    </tr>
  );
}

function formatValueAsString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return JSON.stringify(value);
}

async function fetchCustomFieldDefinitions(): Promise<TaskCustomFieldDefinition[]> {
  const response = await fetch(`${apiOrigin}/api/workspace/config/custom-fields`, {
    credentials: "same-origin"
  });
  if (!response.ok) {
    if (response.status === 403 || response.status === 501) return [];
    throw new Error(`custom_fields_load_failed_${response.status}`);
  }
  const body = (await response.json()) as { customFields?: TaskCustomFieldDefinition[] };
  return body.customFields ?? [];
}
