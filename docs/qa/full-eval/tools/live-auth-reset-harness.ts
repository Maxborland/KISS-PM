import { serve } from "@hono/node-server";
import { hashResetToken } from "@kiss-pm/persistence";
import type {
  AccessProfileRecord,
  ApiTenantDataSource,
  PasswordResetTokenRecord,
  UserCredentialRecord,
  UserSessionRecord,
  WorkspaceUserRecord
} from "../../../../apps/api/src/apiTypes";
import { createApp } from "../../../../apps/api/src/app";
import type { AuthRateLimiter } from "../../../../apps/api/src/authRateLimit";
import { createEmailProviderFromEnv } from "../../../../apps/api/src/emailProvider";

const sameOriginHeaders = {
  "content-type": "application/json",
  "x-kiss-pm-action": "same-origin"
};

function createAuthFakeDataSource() {
  const tenants = new Map<string, { id: string; name: string }>();
  const accessProfiles = new Map<string, AccessProfileRecord>();
  const users = new Map<string, WorkspaceUserRecord>();
  const credentials = new Map<string, UserCredentialRecord>();
  const sessions = new Map<string, UserSessionRecord>();
  const resetTokens = new Map<string, PasswordResetTokenRecord>();
  const auditEvents: unknown[] = [];

  const dataSource: Partial<ApiTenantDataSource> = {
    async listDevUsers() {
      return [];
    },
    async findUserById(userId) {
      return users.get(userId);
    },
    async findTenantById(tenantId) {
      return tenants.get(tenantId);
    },
    async findAccessProfileById(tenantId, accessProfileId) {
      const profile = accessProfiles.get(accessProfileId);
      return profile && profile.tenantId === tenantId ? profile : undefined;
    },
    async listUsersByTenantId(tenantId) {
      return [...users.values()].filter((user) => user.tenantId === tenantId);
    },
    async listWorkspaceUsers(tenantId) {
      return [...users.values()].filter((user) => user.tenantId === tenantId);
    },
    async createTenant(input) {
      tenants.set(input.id, { id: input.id, name: input.name });
    },
    async createAccessProfile(input) {
      accessProfiles.set(input.id, input);
      return input;
    },
    async createWorkspaceUser(input) {
      const record: WorkspaceUserRecord = { ...input, positionName: null };
      users.set(record.id, record);
      return record;
    },
    async findCredentialByEmail(email) {
      return credentials.get(email);
    },
    async upsertCredential(input) {
      credentials.set(input.email, { ...input });
    },
    async updateCredentialPassword(tenantId, userId, input) {
      for (const [email, credential] of credentials) {
        if (credential.tenantId === tenantId && credential.userId === userId) {
          credentials.set(email, { ...credential, ...input });
        }
      }
    },
    async createSession(input) {
      sessions.set(input.tokenHash, { ...input });
    },
    async findSessionByTokenHash(tokenHash) {
      return sessions.get(tokenHash);
    },
    async deleteSessionByTokenHash(tokenHash) {
      sessions.delete(tokenHash);
    },
    async deleteSessionsByUserId(tenantId, userId) {
      for (const [tokenHash, session] of sessions) {
        if (session.tenantId === tenantId && session.userId === userId) {
          sessions.delete(tokenHash);
        }
      }
    },
    async createPasswordResetToken(input) {
      resetTokens.set(input.id, { ...input });
    },
    async findPasswordResetTokenByHash(tokenHash) {
      return [...resetTokens.values()].find((token) => token.tokenHash === tokenHash);
    },
    async markPasswordResetTokenConsumed(tenantId, id, consumedAt) {
      const token = resetTokens.get(id);
      if (token && token.tenantId === tenantId && token.consumedAt === null) {
        resetTokens.set(id, { ...token, consumedAt });
        return 1;
      }
      return 0;
    },
    async deletePasswordResetTokensByUserId(tenantId, userId) {
      for (const [id, token] of resetTokens) {
        if (token.tenantId === tenantId && token.userId === userId) {
          resetTokens.delete(id);
        }
      }
    },
    async deleteOtherPasswordResetTokensByUserId(tenantId, userId, preservedTokenId) {
      for (const [id, token] of resetTokens) {
        if (token.tenantId === tenantId && token.userId === userId && id !== preservedTokenId) {
          resetTokens.delete(id);
        }
      }
    },
    async appendAuditEvent(input) {
      auditEvents.push(input);
    },
    async withTransaction(operation) {
      return operation(dataSource as ApiTenantDataSource);
    }
  };

  return {
    dataSource: dataSource as ApiTenantDataSource,
    state: { auditEvents, credentials, resetTokens, sessions, users }
  };
}

function createOpenAuthRateLimiter(): AuthRateLimiter {
  return {
    async reserveAttempt() {
      return { allowed: true };
    },
    async check() {
      return { allowed: true };
    },
    async recordFailure() {},
    async recordSuccess() {},
    async releaseReservedAttempt() {}
  };
}

const port = Number(process.env.KISS_PM_AUTH_RESET_HARNESS_PORT ?? "4188");
const hostname = "127.0.0.1";
const { dataSource, state } = createAuthFakeDataSource();
const app = createApp({
  authRateLimiter: createOpenAuthRateLimiter(),
  dataSource,
  emailProvider: createEmailProviderFromEnv(process.env),
  secureCookies: false,
  trustedMutationOrigins: [`http://${hostname}:${port}`]
});

app.get("/__qa/state", (context) => {
  return context.json({
    auditEvents: state.auditEvents.length,
    credentials: state.credentials.size,
    resetTokens: [...state.resetTokens.values()].map((token) => ({
      consumed: token.consumedAt !== null,
      hash: token.tokenHash.slice(0, 12),
      userId: token.userId
    })),
    sessions: state.sessions.size,
    users: state.users.size
  });
});

app.post("/__qa/register-and-request", async (context) => {
  const body = await context.req.json<{
    email: string;
    initialPassword: string;
    name: string;
  }>();
  const origin = `http://${hostname}:${port}`;
  const register = await app.request(`${origin}/api/auth/register`, {
    body: JSON.stringify({
      email: body.email,
      name: body.name,
      password: body.initialPassword
    }),
    headers: sameOriginHeaders,
    method: "POST"
  });
  const registerBody = await register.json().catch(() => null);
  const reset = await app.request(`${origin}/api/auth/password-reset/request`, {
    body: JSON.stringify({ email: body.email }),
    headers: sameOriginHeaders,
    method: "POST"
  });
  const resetBody = await reset.json().catch(() => null);
  return context.json({
    register: { body: registerBody, status: register.status },
    reset: { body: resetBody, status: reset.status },
    state: {
      credentials: state.credentials.size,
      resetTokens: state.resetTokens.size,
      tokenHashPreview: [...state.resetTokens.values()][0]?.tokenHash.slice(0, 12) ?? null
    }
  });
});

app.post("/__qa/confirm-readback", async (context) => {
  const body = await context.req.json<{
    email: string;
    initialPassword: string;
    newPassword: string;
    token: string;
  }>();
  const origin = `http://${hostname}:${port}`;
  const confirm = await app.request(`${origin}/api/auth/password-reset/confirm`, {
    body: JSON.stringify({ password: body.newPassword, token: body.token }),
    headers: sameOriginHeaders,
    method: "POST"
  });
  const confirmBody = await confirm.json().catch(() => null);
  const oldLogin = await app.request(`${origin}/api/auth/login`, {
    body: JSON.stringify({ email: body.email, password: body.initialPassword }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  const oldLoginBody = await oldLogin.json().catch(() => null);
  const newLogin = await app.request(`${origin}/api/auth/login`, {
    body: JSON.stringify({ email: body.email, password: body.newPassword }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  const newLoginBody = await newLogin.json().catch(() => null);
  const repeat = await app.request(`${origin}/api/auth/password-reset/confirm`, {
    body: JSON.stringify({ password: `${body.newPassword}-repeat`, token: body.token }),
    headers: sameOriginHeaders,
    method: "POST"
  });
  const repeatBody = await repeat.json().catch(() => null);
  return context.json({
    confirm: { body: confirmBody, status: confirm.status },
    newLogin: {
      body: newLoginBody,
      hasSetCookie: newLogin.headers.has("set-cookie"),
      status: newLogin.status
    },
    oldLogin: { body: oldLoginBody, status: oldLogin.status },
    repeat: { body: repeatBody, status: repeat.status },
    state: {
      auditEvents: state.auditEvents.length,
      resetTokenHashMatchesExtractedToken:
        [...state.resetTokens.values()][0]?.tokenHash === hashResetToken(body.token),
      resetTokens: [...state.resetTokens.values()].map((token) => ({
        consumed: token.consumedAt !== null,
        userId: token.userId
      })),
      sessions: state.sessions.size
    }
  });
});

const server = serve({ fetch: app.fetch, hostname, port });
console.log(`auth-reset-harness ${JSON.stringify({ hostname, port })}`);

function close() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
