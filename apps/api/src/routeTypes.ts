import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";
import type {
  ApiTenantDataSource,
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "./apiTypes";
import type { ApiCapabilities } from "./apiDataPorts";
import type { AuthRateLimiter } from "./authRateLimit";
import type { EmailProvider } from "./emailProvider";
import type { StorageProvider } from "./storageProvider";
import type { VideoProvider } from "./videoProvider";

export type ApiRouteDeps = {
  dataSource: ApiTenantDataSource;
  capabilities: ApiCapabilities;
  authRateLimiter: AuthRateLimiter;
  emailProvider: EmailProvider;
  secureCookies: boolean;
  storageProvider: StorageProvider;
  videoProvider: VideoProvider;
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
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

export type ApiApp = Hono;
