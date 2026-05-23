"use client";

import type { ReactNode } from "react";

import { PlanningDropdownItem, PlanningDropdownMenu } from "../../../../components/ui/dropdown-menu";
import type { PlanningPermissions } from "../../hooks/usePlanningPermissions";
import { planningPermissionTitle } from "../../hooks/usePlanningPermissions";

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
  onIndent: () => void;
  onOutdent: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onFillDown: () => void;
  onDelete: () => void;
}) {
  return (
    <PlanningDropdownMenu trigger={props.trigger} open={props.open} onOpenChange={props.onOpenChange}>
      <PlanningDropdownItem {...manageItemProps(props.permissions, props.onInsertAbove, "Вставить выше")} />
      <PlanningDropdownItem {...manageItemProps(props.permissions, props.onInsertBelow, "Вставить ниже")} />
      <PlanningDropdownItem {...manageItemProps(props.permissions, props.onInsertChild, "Подзадача")} />
      <PlanningDropdownItem {...manageItemProps(props.permissions, props.onIndent, "Увеличить отступ")} />
      <PlanningDropdownItem {...manageItemProps(props.permissions, props.onOutdent, "Уменьшить отступ")} />
      <PlanningDropdownItem label="Копировать" onSelect={props.onCopy} />
      <PlanningDropdownItem {...manageItemProps(props.permissions, props.onCut, "Вырезать")} />
      <PlanningDropdownItem {...manageItemProps(props.permissions, props.onPaste, "Вставить")} />
      <PlanningDropdownItem {...manageItemProps(props.permissions, props.onFillDown, "Заполнить вниз")} />
      <PlanningDropdownItem {...manageItemProps(props.permissions, props.onDelete, "Удалить")} />
    </PlanningDropdownMenu>
  );
}
