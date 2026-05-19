import {
  Activity,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  ContactRound,
  FolderKanban,
  LayoutDashboard,
  Palette,
  PanelsTopLeft,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
  type LucideIcon
} from "lucide-react";

import type { WorkspaceRouteId } from "./routes";

export const workspaceRouteIcons = {
  dashboard: LayoutDashboard,
  opportunities: ClipboardList,
  projects: PanelsTopLeft,
  clients: Building2,
  contacts: ContactRound,
  users: Users,
  "access-roles": ShieldCheck,
  positions: BriefcaseBusiness,
  audit: Activity,
  settings: Settings,
  "project-types": FolderKanban,
  "deal-stages": ClipboardList,
  profile: UserCircle,
  theme: Palette
} satisfies Record<WorkspaceRouteId, LucideIcon>;
