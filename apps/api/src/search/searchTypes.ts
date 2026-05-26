import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";

import type { ApiTenantDataSource } from "../apiTypes";

export type SearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  snippet: string;
  entityType: string;
  entityId: string;
  route: string;
  updatedAt: string;
  score: number;
  source: string;
};

export type WorkspaceSearchInput = {
  actor: TenantUser;
  dataSource: ApiTenantDataSource;
  limit: number;
  profile: AccessProfile;
  query: string;
  requestedTypes: Set<string> | null;
};

export type WorkspaceSearchSource = {
  search(input: WorkspaceSearchInput, limit: number): Promise<SearchResult[]>;
  sourceTypes: string[];
};
