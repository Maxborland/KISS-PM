export type ApiHealth = {
  status: string;
  product: string;
};

export type WorkspaceUser = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  accessProfileId: string;
  positionId: string | null;
  positionName: string | null;
  phone: string | null;
  telegram: string | null;
  status: string;
  theme: string;
  accentColor: string;
};

export type Position = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
};

export type AccessRole = {
  id: string;
  tenantId: string;
  name: string;
  permissions: string[];
};

export type AuthMeResponse = {
  user: WorkspaceUser;
  permissions: string[];
  workspace: {
    id: string;
  };
};

export type AuditEvent = {
  id: string;
  tenantId: string;
  actorUserId: string;
  actionType: string;
  correlationId: string;
  createdAt: string;
};

export async function fetchApiHealth(): Promise<ApiHealth> {
  return requestJson("/health");
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthMeResponse> {
  await requestJson("/api/auth/login", {
    method: "POST",
    body: input
  });
  return fetchMe();
}

export async function logout(): Promise<void> {
  await requestJson("/api/auth/logout", { method: "POST" });
}

export async function fetchMe(): Promise<AuthMeResponse> {
  return requestJson("/api/auth/me");
}

export async function fetchUsers(): Promise<{ users: WorkspaceUser[] }> {
  return requestJson("/api/workspace/users");
}

export async function createUser(input: {
  id: string;
  email: string;
  name: string;
  accessProfileId: string;
  positionId: string | null;
  password: string;
}): Promise<{ user: WorkspaceUser }> {
  return requestJson("/api/workspace/users", {
    method: "POST",
    body: input
  });
}

export async function updateUser(
  userId: string,
  input: {
    email: string;
    name: string;
    accessProfileId: string;
    positionId: string | null;
    status: string;
  }
): Promise<{ user: WorkspaceUser }> {
  return requestJson(`/api/workspace/users/${encodePathSegment(userId)}`, {
    method: "PATCH",
    body: input
  });
}

export async function deleteUser(userId: string): Promise<{ status: string }> {
  return requestJson(`/api/workspace/users/${encodePathSegment(userId)}`, {
    method: "DELETE"
  });
}

export async function fetchPositions(): Promise<{ positions: Position[] }> {
  return requestJson("/api/workspace/positions");
}

export async function createPosition(input: {
  id: string;
  name: string;
  description: string;
}): Promise<{ position: Position }> {
  return requestJson("/api/workspace/positions", {
    method: "POST",
    body: input
  });
}

export async function updatePosition(
  positionId: string,
  input: {
    name: string;
    description: string;
  }
): Promise<{ position: Position }> {
  return requestJson(`/api/workspace/positions/${encodePathSegment(positionId)}`, {
    method: "PATCH",
    body: input
  });
}

export async function deletePosition(positionId: string): Promise<{ status: string }> {
  return requestJson(`/api/workspace/positions/${encodePathSegment(positionId)}`, {
    method: "DELETE"
  });
}

export async function fetchAccessRoles(): Promise<{ accessRoles: AccessRole[] }> {
  return requestJson("/api/workspace/access-roles");
}

export async function createAccessRole(input: {
  id: string;
  name: string;
  permissions: string[];
}): Promise<{ accessProfile: AccessRole }> {
  return requestJson("/api/tenant/current/access-profiles", {
    method: "POST",
    body: input
  });
}

export async function updateAccessRole(
  roleId: string,
  input: {
    name: string;
    permissions: string[];
  }
): Promise<{ accessRole: AccessRole }> {
  return requestJson(`/api/workspace/access-roles/${encodePathSegment(roleId)}`, {
    method: "PATCH",
    body: input
  });
}

export async function deleteAccessRole(roleId: string): Promise<{ status: string }> {
  return requestJson(`/api/workspace/access-roles/${encodePathSegment(roleId)}`, {
    method: "DELETE"
  });
}

export async function updateProfile(input: {
  name: string;
  phone: string;
  telegram: string;
}): Promise<{ user: WorkspaceUser }> {
  return requestJson("/api/profile", {
    method: "PATCH",
    body: input
  });
}

export async function updateTheme(input: {
  theme: string;
  accentColor: string;
}): Promise<{ user: WorkspaceUser }> {
  return requestJson("/api/profile/theme", {
    method: "PATCH",
    body: input
  });
}

export async function fetchAuditEvents(): Promise<{ auditEvents: AuditEvent[] }> {
  return requestJson("/api/tenant/current/audit-events");
}

async function requestJson<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? "GET",
    credentials: "same-origin"
  };

  if (options.body !== undefined) {
    init.headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin"
    };
    init.body = JSON.stringify(options.body);
  } else if (init.method && init.method !== "GET") {
    init.headers = {
      "x-kiss-pm-action": "same-origin"
    };
  }

  const response = await fetch(path, init);

  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}
