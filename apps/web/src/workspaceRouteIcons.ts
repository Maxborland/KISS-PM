import {
  Activity,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  Columns3,
  ContactRound,
  FolderKanban,
  LayoutDashboard,
  Palette,
  PackageOpen,
  PanelsTopLeft,
  SquareCheckBig,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
  type LucideIcon
} from "lucide-react";

import type { WorkspaceRouteId } from "./routes";

export const workspaceRouteIcons = {
  dashboard: LayoutDashboard,
  "my-work": SquareCheckBig,
  opportunities: ClipboardList,
  projects: PanelsTopLeft,
  clients: Building2,
  contacts: ContactRound,
  products: PackageOpen,
  users: Users,
  "access-roles": ShieldCheck,
  positions: BriefcaseBusiness,
  audit: Activity,
  settings: Settings,
  "project-types": FolderKanban,
  "deal-stages": ClipboardList,
  "task-statuses": Columns3,
  profile: UserCircle,
  theme: Palette
} satisfies Record<WorkspaceRouteId, LucideIcon>;
