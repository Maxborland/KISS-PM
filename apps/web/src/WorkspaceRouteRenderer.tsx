import { ProfileView, ThemeView } from "./AccountViews";
import { AuditView } from "./AuditView";
import { DashboardView } from "./DashboardView";
import { PositionsView } from "./PositionsView";
import { RolesView } from "./RolesView";
import { UsersView } from "./UsersView";
import { WorkspaceSettingsView } from "./WorkspaceSettingsView";
import { type WorkspaceRouteId } from "./routes";
import { type WorkspaceData } from "./workspaceData";
import { type SectionState } from "./workspaceShellState";

export function WorkspaceRouteRenderer(props: {
  activeRouteId: WorkspaceRouteId;
  data: WorkspaceData;
  openCreateRequested: boolean;
  onChanged: (message: string) => void;
  onQuickCreateConsumed: () => void;
  sectionStates: {
    users: SectionState;
    positions: SectionState;
    accessRoles: SectionState;
    auditEvents: SectionState;
    workspaceConfig: SectionState;
  };
}) {
  if (props.activeRouteId === "dashboard") {
    return (
      <DashboardView
        data={props.data}
        sectionStates={props.sectionStates}
      />
    );
  }

  if (props.activeRouteId === "users") {
    return (
      <UsersView
        data={props.data}
        openCreateRequested={props.openCreateRequested}
        onQuickCreateConsumed={props.onQuickCreateConsumed}
        sectionState={props.sectionStates.users}
        onChanged={props.onChanged}
      />
    );
  }

  if (props.activeRouteId === "access-roles") {
    return (
      <RolesView
        data={props.data}
        sectionState={props.sectionStates.accessRoles}
        onChanged={props.onChanged}
      />
    );
  }

  if (props.activeRouteId === "positions") {
    return (
      <PositionsView
        data={props.data}
        sectionState={props.sectionStates.positions}
        onChanged={props.onChanged}
      />
    );
  }

  if (props.activeRouteId === "audit") {
    return (
      <AuditView
        data={props.data}
        sectionState={props.sectionStates.auditEvents}
      />
    );
  }

  if (props.activeRouteId === "settings") {
    return (
      <WorkspaceSettingsView
        data={props.data}
        sectionState={props.sectionStates.workspaceConfig}
        onChanged={props.onChanged}
      />
    );
  }

  if (props.activeRouteId === "profile") {
    return (
      <ProfileView
        data={props.data}
        onChanged={props.onChanged}
      />
    );
  }

  if (props.activeRouteId === "theme") {
    return (
      <ThemeView
        user={props.data.me}
        onChanged={props.onChanged}
      />
    );
  }

  return null;
}
