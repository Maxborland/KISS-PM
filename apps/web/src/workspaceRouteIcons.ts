import {
  Activity,
  BriefcaseBusiness,
  ClipboardList,
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
  users: Users,
  "access-roles": ShieldCheck,
  positions: BriefcaseBusiness,
  audit: Activity,
  settings: Settings,
  profile: UserCircle,
  theme: Palette
} satisfies Record<WorkspaceRouteId, LucideIcon>;
