"use client";

import * as React from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";

export type SwitchRowProps = {
  label: string;
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
};

/**
 * Строка списка настроек: текст слева, переключатель справа.
 * Используется внутри `<SwitchRowList>` или `<CardPanel>` секций settings.
 */
export function SwitchRow({
  label,
  description,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  className,
  id
}: SwitchRowProps) {
  const inputId = React.useId();
  const fieldId = id ?? inputId;
  return (
    <div className={cn("switch-row", className)}>
      <label
        htmlFor={fieldId}
        className={cn("switch-row__label-wrap", disabled && "is-disabled")}
      >
        <span className="switch-row__label">{label}</span>
        {description ? <span className="switch-row__desc">{description}</span> : null}
      </label>
      <Switch
        id={fieldId}
        {...(checked !== undefined ? { checked } : {})}
        {...(defaultChecked !== undefined ? { defaultChecked } : {})}
        {...(onCheckedChange ? { onCheckedChange } : {})}
        {...(disabled ? { disabled } : {})}
      />
    </div>
  );
}

export function SwitchRowList({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("switch-row-list", className)}>{children}</div>;
}
