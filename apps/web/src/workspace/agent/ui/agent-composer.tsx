"use client";

import { useRef, type RefObject } from "react";
import { Paperclip, Send } from "lucide-react";

import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";

export type AgentAttachment = { id: string; name: string };
export type AgentAnchorProject = { id: string; label: string };

/**
 * Композер агента: строка ввода + вложения. Лейблы «Сообщение Генри Гантту» /
 * «Отправить» / «Прикрепить файл» — контракт e2e agent-partial-apply, не менять.
 */
export function AgentComposer({
  value,
  inputRef,
  disabled,
  projects,
  anchorId,
  attachments,
  onChange,
  onSend,
  onAnchorChange,
  onFilePicked,
  onRemoveAttachment,
  onAttachDenied
}: {
  value: string;
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  projects: AgentAnchorProject[];
  anchorId: string;
  attachments: AgentAttachment[];
  onChange: (value: string) => void;
  onSend: () => void;
  onAnchorChange: (id: string) => void;
  onFilePicked: (file: File) => void;
  onRemoveAttachment: (id: string) => void;
  /** Клик по скрепке без выбранного якоря — поверхность объясняет, что нужно. */
  onAttachDenied: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const showAttachBar = projects.length > 0 || attachments.length > 0;

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--panel)] px-4 py-3 md:px-6">
      {showAttachBar ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select
            className="h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-sm)] text-[var(--text)]"
            value={anchorId}
            onChange={(event) => onAnchorChange(event.target.value)}
            aria-label="Проект-якорь для файла"
            disabled={disabled}
          >
            <option value="">Привязать файл к проекту…</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.label}</option>
            ))}
          </select>
          {attachments.map((file) => (
            // Нейтральный чип: panel-strong/text адаптированы в dark,
            // accent-soft тёмного значения не имеет (текст был бы нечитаем).
            <span
              key={file.id}
              className="inline-flex items-center gap-1 rounded-[var(--radius-full)] border border-[var(--border-strong)] bg-[var(--panel-strong)] px-2.5 py-1 text-[length:var(--text-sm)] text-[var(--text)]"
            >
              {file.name}
              <button
                type="button"
                aria-label={`Убрать файл ${file.name}`}
                className="grid size-4 place-items-center rounded-full text-[var(--muted-strong)] hover:bg-[var(--border)]"
                onClick={() => onRemoveAttachment(file.id)}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={fileRef}
            type="file"
            hidden
            accept=".txt,.md,.markdown,.csv,.json,.yaml,.yml,text/*,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFilePicked(file);
              event.target.value = "";
            }}
          />
        </div>
      ) : null}
      <form
        data-testid="agent-composer"
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <Input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Сообщение Генри Гантту..."
          aria-label="Сообщение Генри Гантту"
          disabled={disabled}
        />
        <IconButton
          type="button"
          label="Прикрепить файл"
          disabled={disabled}
          onClick={() => {
            if (!anchorId) {
              onAttachDenied();
              return;
            }
            fileRef.current?.click();
          }}
        >
          <Paperclip aria-hidden />
        </IconButton>
        <Button type="submit" size="sm" disabled={disabled || !value.trim()}>
          <Send aria-hidden />
          Отправить
        </Button>
      </form>
    </div>
  );
}
