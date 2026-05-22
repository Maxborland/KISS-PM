import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";
import type {
  ApiTenantDataSource,
  ManagementAuditEventInput
} from "./apiTypes";
import type { AuthRateLimiter } from "./authRateLimit";

export type ApiRouteDeps = {
  dataSource: ApiTenantDataSource;
  authRateLimiter: AuthRateLimiter;
  secureCookies: boolean;
  trustForwardedAuthHeaders: boolean;
  getActor(userId: string | null): Promise<TenantUser | undefined>;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getDevActorFromHeaders(input: {
    cookie: string | null;
    userId: string | null;
  }): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  isWorkspaceUserActive(user: TenantUser): Promise<boolean>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

export type ApiApp = Hono;
