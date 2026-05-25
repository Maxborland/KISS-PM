"use client";

import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import type {
  KanbanCardViewProfile,
  KanbanCardViewState
} from "@/widgets/kanban/types";

export type KanbanCardViewMenuProps = {
  profile: KanbanCardViewProfile;
  value: KanbanCardViewState;
  onChange: (next: KanbanCardViewState) => void;
  label?: string;
};

/**
 * Меню «Вид карточки» — потребитель рендерит его в своём toolbar
 * (рядом с режимами просмотра и фильтром). Управляет видимыми полями
 * для текущего профиля (`task` / `deal`); обязательные поля скрыть нельзя.
 */
export function KanbanCardViewMenu({
  profile,
  value,
  onChange,
  label = "Вид карточки"
}: KanbanCardViewMenuProps) {
  const handleToggle = (fieldId: string, next: boolean) => {
    onChange({ ...value, [fieldId]: next });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" aria-label={label}>
          <SlidersHorizontal className="size-4" aria-hidden />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Поля карточки — {profile.label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profile.fields.map((field) => {
          const checked = value[field.id] ?? field.defaultOn;
          const required = field.required ?? false;
          return (
            <DropdownMenuCheckboxItem
              key={field.id}
              checked={checked}
              disabled={required}
              onCheckedChange={(next) => handleToggle(field.id, Boolean(next))}
              onSelect={(event) => event.preventDefault()}
            >
              {field.label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Утилита: возвращает `Set` активных полей из state + профиля. */
export function resolveVisibleFields(
  profile: KanbanCardViewProfile,
  state: KanbanCardViewState
): ReadonlySet<string> {
  const set = new Set<string>();
  for (const field of profile.fields) {
    const on = state[field.id] ?? field.defaultOn;
    if (on || field.required) set.add(field.id);
  }
  return set;
}
