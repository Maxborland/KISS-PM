import { useState } from "react";

import type { CustomFieldDefinition } from "./api";
import { getErrorMessage } from "./workspaceShellState";
import { DatePickerField } from "./components/DatePickerField";

export function InlineEditableValue(props: {
  disabled?: boolean;
  display?: React.ReactNode;
  label: string;
  mode?: "date" | "number" | "select" | "text" | "textarea";
  options?: { label: string; value: string }[];
  suffix?: string;
  value: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(props.value);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const mode = props.mode ?? "text";

  function startEdit() {
    if (props.disabled) return;
    setDraft(props.value);
    setError("");
    setIsEditing(true);
  }

  function cancelEdit() {
    setDraft(props.value);
    setError("");
    setIsEditing(false);
  }

  async function save() {
    setError("");
    setIsSaving(true);
    try {
      await props.onSave(draft);
      setIsEditing(false);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    if (props.disabled) {
      return (
        <span className="inline-readonly-value">
          {props.display ?? formatInlineDisplay(props.value, props.suffix)}
        </span>
      );
    }

    return (
      <button
        className="inline-edit-trigger"
        type="button"
        aria-label={`Редактировать поле ${props.label}`}
        onClick={startEdit}
      >
        {props.display ?? formatInlineDisplay(props.value, props.suffix)}
      </button>
    );
  }

  return (
    <span className="inline-edit-control">
      {mode === "select" ? (
        <select
          aria-label={props.label}
          autoFocus
          disabled={isSaving}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancelEdit();
          }}
        >
          {props.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : mode === "date" ? (
        <DatePickerField
          disabled={isSaving}
          id={`inline-date-${toStableDomId(props.label)}`}
          label={props.label}
          value={draft}
          onChange={setDraft}
        />
      ) : mode === "textarea" ? (
        <textarea
          aria-label={props.label}
          autoFocus
          disabled={isSaving}
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancelEdit();
          }}
        />
      ) : (
        <input
          aria-label={props.label}
          autoFocus
          disabled={isSaving}
          type={mode}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancelEdit();
            if (event.key === "Enter") void save();
          }}
        />
      )}
      {error ? <small className="inline-edit-error" role="alert">{error}</small> : null}
      <span className="inline-edit-actions">
        <button
          className="primary-button compact"
          disabled={isSaving}
          type="button"
          onClick={save}
        >
          {isSaving ? "Сохраняем..." : "Сохранить"}
        </button>
        <button
          className="secondary-button compact"
          disabled={isSaving}
          type="button"
          onClick={cancelEdit}
        >
          Отмена
        </button>
      </span>
    </span>
  );
}

export function getInlineCustomFieldMode(
  field: CustomFieldDefinition
): "date" | "number" | "text" {
  if (field.fieldType === "date") return "date";
  if (field.fieldType === "number") return "number";
  return "text";
}

function toStableDomId(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .split("")
      .map((character) => {
        if (/^[a-z0-9]$/.test(character)) return character;
        return `-${character.charCodeAt(0).toString(36)}`;
      })
      .join("")
      .replace(/^-+/, "")
      .replace(/-+$/, "") || "field"
  );
}

function formatInlineDisplay(value: string, suffix?: string): string {
  const visibleValue = value.trim() || "-";
  return suffix && value.trim() ? `${visibleValue} ${suffix}` : visibleValue;
}
