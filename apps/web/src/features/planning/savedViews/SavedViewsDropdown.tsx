"use client";

import {
  PlanningDropdownItem,
  PlanningDropdownMenu
} from "../../../components/ui/dropdown-menu";
import type { SavedView } from "./useSavedViews";

export function SavedViewsDropdown(props: {
  activeViewId: string | null;
  views: SavedView[];
  canManage: boolean;
  onSelect: (view: SavedView | null) => void;
  onCreate: () => void;
  onDelete: (view: SavedView) => void;
}) {
  const activeView = props.views.find((view) => view.id === props.activeViewId) ?? null;

  return (
    <div className="saved-views-dropdown" data-testid="saved-views-dropdown">
      <PlanningDropdownMenu
        trigger={
          <button className="secondary-button" type="button">
            Вид: {activeView?.name ?? "По умолчанию"}
          </button>
        }
      >
        <PlanningDropdownItem
          label="По умолчанию"
          onSelect={() => props.onSelect(null)}
        />
        {props.views.map((view) => (
          <PlanningDropdownItem
            key={view.id}
            label={`${view.name}${view.scope === "project" ? " (проект)" : ""}`}
            onSelect={() => props.onSelect(view)}
          />
        ))}
        {props.canManage ? (
          <PlanningDropdownItem
            label="Сохранить текущий вид…"
            onSelect={props.onCreate}
          />
        ) : null}
        {props.canManage && activeView ? (
          <PlanningDropdownItem
            label={`Удалить «${activeView.name}»`}
            onSelect={() => props.onDelete(activeView)}
          />
        ) : null}
      </PlanningDropdownMenu>
    </div>
  );
}
