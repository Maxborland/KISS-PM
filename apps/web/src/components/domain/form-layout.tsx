import type { KeyboardEvent, ReactNode } from "react";
import { X } from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";

export function FormSection({
  title,
  lead,
  actions,
  children,
  className
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("form-section", className)}>
      <header className="form-section__head">
        <h3 className="form-section__title">{title}</h3>
        {lead ? <p className="form-section__lead">{lead}</p> : null}
        {actions ? <div className="btn-group form-section__actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export type FormGridColumns = 1 | 2 | 3;

export function FormGrid({
  children,
  className,
  columns = 2
}: {
  children: ReactNode;
  className?: string;
  columns?: FormGridColumns;
}) {
  return (
    <div
      className={cn(
        "form-grid",
        columns === 1 && "form-grid--single",
        columns === 3 && "form-grid--triple",
        className
      )}
    >
      {children}
    </div>
  );
}

export type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  full?: boolean;
  inline?: boolean;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
};

export function Field({
  label,
  hint,
  error,
  full,
  inline,
  required,
  htmlFor,
  children,
  className
}: FieldProps) {
  return (
    <div
      className={cn(
        "field",
        inline && "field--inline",
        full && "field--full",
        error && "field--error",
        className
      )}
    >
      <label
        className={cn("field__label", required && "field__label--required")}
        htmlFor={htmlFor}
      >
        {label}
      </label>
      <div className="field__control">{children}</div>
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function FormActions({
  children,
  align = "end",
  className
}: {
  children: ReactNode;
  align?: "start" | "end" | "between";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "form-actions",
        align === "start" && "form-actions--start",
        align === "between" && "form-actions--between",
        className
      )}
    >
      {children}
    </div>
  );
}

export type TagsInputProps = {
  tags: string[];
  onRemove?: (tag: string) => void;
  onAdd?: (tag: string) => void;
  placeholder?: string;
};

export function TagsInput({ tags, onRemove, onAdd, placeholder = "Добавить тег…" }: TagsInputProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = event.currentTarget.value.trim();
    if (!value || tags.includes(value)) return;
    onAdd?.(value);
    event.currentTarget.value = "";
  };

  return (
    <div className="tags-input">
      {tags.map((t) => (
        <Chip key={t} variant="info">
          {t}
          {onRemove ? (
            <button
              type="button"
              className="ml-1 inline-flex size-4 items-center justify-center rounded-full text-current/70 hover:text-current cursor-pointer"
              aria-label={`Удалить тег ${t}`}
              onClick={() => onRemove(t)}
            >
              <X className="size-3" aria-hidden />
            </button>
          ) : null}
        </Chip>
      ))}
      <input
        className="tags-input__field"
        placeholder={placeholder}
        aria-label={placeholder}
        onKeyDown={onAdd ? handleKeyDown : undefined}
      />
    </div>
  );
}
