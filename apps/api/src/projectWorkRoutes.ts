import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";

import type { ApiTenantDataSource, ManagementAuditEventInput } from "./apiTypes";
import { registerProjectStatusRoutes } from "./project-work/projectStatusRoutes";
import { registerProjectTaskStageRoutes } from "./project-work/projectTaskStageRoutes";
import { registerTaskCommandRoutes } from "./project-work/taskCommandRoutes";
import { registerTaskReadRoutes } from "./project-work/taskReadRoutes";
import { registerTaskStatusRoutes } from "./project-work/taskStatusRoutes";

export type ProjectWorkRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    event: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

export function registerProjectWorkRoutes(app: Hono, deps: ProjectWorkRouteDeps) {
  registerProjectStatusRoutes(app, deps);
  registerProjectTaskStageRoutes(app, deps);
  registerTaskReadRoutes(app, deps);
  registerTaskCommandRoutes(app, deps);
  registerTaskStatusRoutes(app, deps);
}
