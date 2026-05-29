"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";
import type { GanttContextAction, GanttContextMenuState } from "./types";

export type GanttContextMenuItem = {
  action: GanttContextAction;
  label: string;
  disabled?: boolean;
};

const DEFAULT_ITEMS: GanttContextMenuItem[] = [
  { action: "openTaskDetails", label: "Открыть свойства" },
  { action: "insertTaskAbove", label: "Добавить задачу выше" },
  { action: "insertTaskBelow", label: "Добавить задачу ниже" },
  { action: "deleteTask", label: "Удалить задачу" },
  { action: "copyCells", label: "Копировать" },
  { action: "pasteCells", label: "Вставить" },
  { action: "clearCells", label: "Очистить ячейку" },
  { action: "shiftTaskRight", label: "Сдвинуть вправо" },
  { action: "shiftTaskLeft", label: "Сдвинуть влево" },
  { action: "outdentTask", label: "Повысить уровень" },
  { action: "indentTask", label: "Понизить уровень" },
  { action: "linkTasks", label: "Связать задачи" },
  { action: "deleteDependency", label: "Удалить связь" }
];

export function GanttContextMenu({
  menu,
  items = DEFAULT_ITEMS,
  onAction,
  onClose
}: {
  menu: GanttContextMenuState | null;
  items?: GanttContextMenuItem[];
  onAction: (action: GanttContextAction) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onPointer = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  return (
    <div
      ref={ref}
      className="gantt2__ctx-menu"
      role="menu"
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.action}
          type="button"
          role="menuitem"
          className={cn("gantt2__ctx-menu-item", item.disabled && "gantt2__ctx-menu-item--disabled")}
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            onAction(item.action);
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function buildContextMenuItems(
  menu: GanttContextMenuState,
  opts: {
    hasSelection: boolean;
    canPaste: boolean;
    hasRow: boolean;
    hasDependency: boolean;
    linkModeAvailable: boolean;
  }
): GanttContextMenuItem[] {
  const rowId =
    menu.target.kind === "row" || menu.target.kind === "cell" || menu.target.kind === "bar"
      ? menu.target.rowId
      : undefined;

  return DEFAULT_ITEMS.map((item) => {
    let disabled = false;
    switch (item.action) {
      case "openTaskDetails":
        disabled = !rowId;
        break;
      case "insertTaskAbove":
      case "insertTaskBelow":
      case "deleteTask":
      case "shiftTaskRight":
      case "shiftTaskLeft":
      case "outdentTask":
      case "indentTask":
        disabled = !rowId;
        break;
      case "copyCells":
      case "clearCells":
        disabled = !opts.hasSelection;
        break;
      case "pasteCells":
        disabled = !opts.canPaste;
        break;
      case "linkTasks":
        disabled = !opts.linkModeAvailable || !rowId;
        break;
      case "deleteDependency":
        disabled = !opts.hasDependency;
        break;
      default:
        break;
    }
    return { ...item, disabled };
  });
}
