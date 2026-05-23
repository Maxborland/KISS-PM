"use client";

import type { ReactNode } from "react";

import { PlanningDropdownItem, PlanningDropdownMenu } from "../../../../components/ui/dropdown-menu";
import type { PlanningPermissions } from "../../hooks/usePlanningPermissions";
import { planningPermissionTitle } from "../../hooks/usePlanningPermissions";

function indentOutdentTitleProps(
  permissions: PlanningPermissions,
  canMove: boolean,
  blockedReason: string
): { title?: string } {
  if (!permissions.canManageProjectPlan) {
    const title = planningPermissionTitle(permissions, "canManageProjectPlan");
    return title ? { title } : {};
  }
  if (!canMove) return { title: blockedReason };
  return {};
}

function manageItemProps(
  permissions: PlanningPermissions,
  onSelect: () => void,
  label: string
) {
  const disabled = !permissions.canManageProjectPlan;
  const title = disabled ? planningPermissionTitle(permissions, "canManageProjectPlan") : undefined;
  return { label, disabled, ...(title ? { title } : {}), onSelect };
}

export function WbsContextMenu(props: {
  trigger: ReactNode;
  permissions: PlanningPermissions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onInsertChild: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onFillDown: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  canIndent: boolean;
  canOutdent: boolean;
  onDelete: () => void;
}) {
  return (
    <PlanningDropdownMenu trigger={props.trigger} open={props.open} onOpenChange={props.onOpenChange}>
      <PlanningDropdownItem {...manageItemProps(props.permissions, props.onInsertAbove, "Вставить выше")} />
      <PlanningDropdownItem {...manageItemProps(props.permissions, props.onInsertBelow, "Вставить ниже")} />
      <PlanningDropdownItem {...manageItemProps(props.permissions, props.onInsertChild, "Подзадача")} />
      <PlanningDropdownItem
        label="Увеличить отступ"
        disabled={!props.permissions.canManageProjectPlan || !props.canIndent}
        {...indentOutdentTitleProps(
          props.permissions,
          props.canIndent,
          "Нет строки выше для вложения"
        )}
        onSelect={props.onIndent}
      />
      <PlanningDropdownItem
        label="Уменьшить отступ"
        disabled={!props.permissions.canManageProjectPlan || !props.canOutdent}
        {...indentOutdentTitleProps(
          props.permissions,
          props.canOutdent,
          "Задача уже на верхнем уровне WBS"
        )}
        onSelect={props.onOutdent}
      />
      <PlanningDropdownItem label="Копировать" onSelect={props.onCopy} />
      <PlanningDropdownItem {...manageItemProps(props.permissions, props.onPaste, "Вставить")} />
      <PlanningDropdownItem {...manageItemProps(props.permissions, props.onFillDown, "Заполнить вниз")} />
      <PlanningDropdownItem {...manageItemProps(props.permissions, props.onDelete, "Удалить")} />
    </PlanningDropdownMenu>
  );
}
