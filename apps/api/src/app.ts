import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";

import { createPhase2RuntimeState } from "./phase2Runtime";
import type { Phase2RuntimeSession, Phase2RuntimeState } from "./phase2Runtime";
import { createPhase3CrmRuntimeState } from "./phase3Runtime";
import type {
  Phase3AccountCreateInput,
  Phase3ContactCreateInput,
  Phase3OpportunityCreateInput
} from "./phase3Runtime";

type ApiErrorCode =
  | "unauthenticated"
  | "permission_denied"
  | "tenant_mismatch"
  | "unsupported_scope"
  | "validation_error"
  | "not_found"
  | "conflict"
  | "not_implemented"
  | "test_mode_only";

export type CreateApiAppOptions = {
  allowTestFixtureReset?: boolean;
};

const scopeSchema = z.enum(["own", "project", "tenant", "all"]);

const upsertAccessProfileSchema = z.object({
  id: z.string().trim().min(1).optional(),
  version: z.number().int().positive().optional(),
  systemKey: z.string().trim().min(1),
  label: z.string().trim().min(1),
  permissions: z.array(z.string().trim().min(1)).min(1),
  scopeRules: z
    .array(
      z.object({
        permissionKey: z.string().trim().min(1),
        scope: scopeSchema,
        constraints: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
      })
    )
    .min(1),
  active: z.boolean()
});

const updateTenantLabelSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  expectedConfigurationVersion: z.number().int().positive()
});

const permissionDiagnosticsSchema = z.object({
  permissionKey: z.string().trim().min(1),
  targetEntityType: z.string().trim().min(1),
  targetEntityId: z.string().trim().min(1).optional(),
  targetTenantId: z.string().trim().min(1).optional(),
  requestedScope: z.string().trim().min(1).optional()
});

const emptyBodySchema = z.object({}).strict();

const moneyAmountSchema = z
  .object({
    amount: z.number().positive(),
    currency: z.string().trim().regex(/^[A-Z]{3}$/)
  })
  .strict();

const accountCreateSchema = z
  .object({
    displayName: z.string().trim().min(1),
    legalName: z.string().trim().min(1).optional(),
    taxId: z.string().trim().min(1).optional()
  })
  .strict();

const contactCreateSchema = z
  .object({
    accountId: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1),
    email: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).optional(),
    roleLabel: z.string().trim().min(1).optional()
  })
  .strict();

const opportunityScopeHintSchema = z
  .object({
    key: z.string().trim().min(1),
    label: z.string().trim().min(1),
    value: z.union([z.string(), z.number(), z.boolean()])
  })
  .strict();

const opportunityCustomFieldRefSchema = z
  .object({
    definitionId: z.string().trim().min(1),
    key: z.string().trim().min(1)
  })
  .strict();

const createOpportunitySchema = z
  .object({
    title: z.string().trim().min(1),
    accountId: z.string().trim().min(1).optional(),
    contactIds: z.array(z.string().trim().min(1)).optional(),
    account: accountCreateSchema.optional(),
    contacts: z.array(contactCreateSchema).optional(),
    plannedStartDate: z.string().trim().min(1),
    desiredFinishDate: z.string().trim().min(1),
    expectedValue: moneyAmountSchema,
    probability: z.number().min(0).max(1),
    categoryKey: z.string().trim().min(1),
    typologyKey: z.string().trim().min(1),
    scopeHints: z.array(opportunityScopeHintSchema).optional(),
    customFieldRefs: z.array(opportunityCustomFieldRefSchema).optional()
  })
  .strict()
  .superRefine((input, context) => {
    if (input.accountId !== undefined && input.account !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["accountId"],
        message: "Use either accountId or account, not both"
      });
    }
    if (input.contactIds !== undefined && input.contacts !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["contactIds"],
        message: "Use either contactIds or contacts, not both"
      });
    }
  });

function errorDto(code: ApiErrorCode, message: string) {
  return { code, message };
}

function mapPolicyReasonToErrorCode(reasonCode: string): ApiErrorCode {
  if (reasonCode === "tenant_mismatch") return "tenant_mismatch";
  if (reasonCode === "unsupported_scope") return "unsupported_scope";
  return "permission_denied";
}

function accessProfileDto(profile: {
  id: string;
  tenantId: string;
  systemKey: string;
  label: string;
  permissions: string[];
  scopeRules: Array<{ permissionKey: string; scope: string; constraints?: Record<string, string | number | boolean> }>;
  active: boolean;
  version: number;
  updatedAt: string;
}) {
  return {
    id: profile.id,
    tenantId: profile.tenantId,
    systemKey: profile.systemKey,
    label: profile.label,
    permissions: [...profile.permissions],
    scopeRules: profile.scopeRules.map((rule) => ({
      permissionKey: rule.permissionKey,
      scope: rule.scope,
      ...(rule.constraints !== undefined ? { constraints: { ...rule.constraints } } : {})
    })),
    active: profile.active,
    version: profile.version,
    updatedAt: profile.updatedAt
  };
}

function auditEventDto(event: {
  id: string;
  tenantId: string;
  actorId: string;
  actionKey: string;
  target: { entityType: string; entityId: string };
  result: string;
  timestamp: string;
  correlationId: string;
  details?: unknown;
}) {
  return {
    id: event.id,
    tenantId: event.tenantId,
    actorId: event.actorId,
    actionKey: event.actionKey,
    target: { ...event.target },
    result: event.result,
    timestamp: event.timestamp,
    correlationId: event.correlationId,
    ...(event.details !== undefined ? { details: event.details } : {})
  };
}

async function parseJson(context: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    throw new Error("invalid_json");
  }
}

function requireSession(runtime: Phase2RuntimeState, testUserId: string | undefined): Phase2RuntimeSession {
  const session = runtime.resolveSession(testUserId);
  if (!session) {
    throw new Error("unauthenticated");
  }

  return session;
}

function assertAllowed(
  runtime: Phase2RuntimeState,
  session: Phase2RuntimeSession,
  permissionKey: string,
  target: { entityType: string; tenantId: string; entityId?: string },
  requestedScope?: string
) {
  const evaluation = runtime.evaluatePolicy({
    session,
    permissionKey,
    target,
    ...(requestedScope !== undefined ? { requestedScope } : {})
  });

  if (!evaluation.allowed) {
    const code = mapPolicyReasonToErrorCode(evaluation.reasonCode);
    throw Object.assign(new Error(code), { code, status: 403 });
  }

  return evaluation;
}

export function createApiApp(options: CreateApiAppOptions = {}) {
  const app = new Hono();
  let runtime = createPhase2RuntimeState();
  let phase3Runtime = createPhase3CrmRuntimeState();

  app.get("/health", (context) =>
    context.json({
      status: "ok",
      service: "kiss-pm-api"
    })
  );

  app.get("/tenants/current", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.read", {
        entityType: "tenant",
        tenantId: session.user.tenantId,
        entityId: session.tenant.id
      });

      return context.json({
        tenant: {
          id: session.tenant.id,
          label: session.tenant.label,
          configurationVersion: session.labelSet.configurationVersion
        },
        actor: {
          id: session.user.id,
          displayName: session.user.displayName,
          accessProfileId: session.user.accessProfileId
        },
        labels: { ...session.labelSet.labels },
        permissions: [...session.profile.permissions]
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/admin/access-profiles", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "access_profile.read", {
        entityType: "accessProfile",
        tenantId: session.user.tenantId
      });

      return context.json({
        profiles: runtime.listProfiles(session.user.tenantId).map(accessProfileDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/admin/access-profiles", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "access_profile.write", {
        entityType: "accessProfile",
        tenantId: session.user.tenantId
      });

      const body = upsertAccessProfileSchema.parse(await parseJson(context));
      const profileId = body.id ?? `profile-${body.systemKey}-${session.user.tenantId}`;
      const existingProfile = runtime.getProfile(session.user.tenantId, profileId);

      if (existingProfile && body.version !== existingProfile.version) {
        return context.json(errorDto("conflict", "Версия профиля доступа устарела"), 409);
      }

      const permissionCatalog = runtime.permissionCatalog.filter((permission) => body.permissions.includes(permission.key));
      if (permissionCatalog.length !== body.permissions.length) {
        return context.json(errorDto("validation_error", "Запрошено неизвестное разрешение"), 400);
      }

      const profile = runtime.saveProfile({
        id: profileId,
        tenantId: session.user.tenantId,
        systemKey: body.systemKey,
        label: body.label,
        permissions: body.permissions,
        scopeRules: body.scopeRules.map((rule) => ({
          permissionKey: rule.permissionKey,
          scope: rule.scope,
          ...(rule.constraints !== undefined ? { constraints: rule.constraints } : {})
        })),
        active: body.active,
        version: existingProfile ? existingProfile.version + 1 : 1,
        updatedAt: runtime.now()
      });

      runtime.appendAuditEvent({
        session,
        actionKey: "access_profile.upsert",
        target: { entityType: "accessProfile", entityId: profile.id },
        details: {
          before: existingProfile ? accessProfileDto(existingProfile) : undefined,
          after: accessProfileDto(profile)
        }
      });

      return context.json(accessProfileDto(profile), existingProfile ? 200 : 201);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/admin/labels", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant_labels.write", {
        entityType: "tenantLabelSet",
        tenantId: session.user.tenantId
      });

      const body = updateTenantLabelSchema.parse(await parseJson(context));
      if (!Object.hasOwn(session.labelSet.labels, body.key)) {
        return context.json(errorDto("validation_error", "Метка не настроена для тенанта"), 400);
      }

      const result = runtime.updateLabelSet(session.user.tenantId, body);
      runtime.appendAuditEvent({
        session,
        actionKey: "tenant_label.update",
        target: { entityType: "tenantLabel", entityId: result.trace.changedLabel.key },
        details: {
          before: { label: result.trace.changedLabel.beforeLabel },
          after: { label: result.trace.changedLabel.afterLabel },
          previousConfigurationVersion: result.trace.previousConfigurationVersion,
          newConfigurationVersion: result.trace.configurationVersion,
          changedLabel: result.trace.changedLabel
        }
      });

      return context.json({
        tenantId: result.trace.tenantId,
        configurationVersion: result.trace.configurationVersion,
        previousConfigurationVersion: result.trace.previousConfigurationVersion,
        changedLabel: result.trace.changedLabel,
        labels: result.trace.labels
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/admin/permissions/evaluate", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "permission.diagnostics.read", {
        entityType: "permissionDiagnostics",
        tenantId: session.user.tenantId
      });

      const body = permissionDiagnosticsSchema.parse(await parseJson(context));
      const resolvedTargetTenantId = resolveDiagnosticsTargetTenantId(runtime, session, body);
      if (resolvedTargetTenantId === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      const evaluation = runtime.evaluatePolicy({
        session,
        permissionKey: body.permissionKey,
        target: {
          entityType: body.targetEntityType,
          tenantId: resolvedTargetTenantId
        },
        ...(body.requestedScope !== undefined ? { requestedScope: body.requestedScope } : {})
      });

      return context.json({
        allowed: evaluation.allowed,
        reasonCode: evaluation.reasonCode,
        ...(evaluation.scope !== undefined ? { scope: evaluation.scope } : {}),
        trace: evaluation.trace
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/tenant-isolation-probes/:probeId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const probeId = context.req.param("probeId");
      const probe = runtime.getProbe(probeId);
      if (!probe || probe.tenantId !== session.user.tenantId) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      assertAllowed(runtime, session, "tenant_probe.read", {
        entityType: "tenantIsolationProbe",
        tenantId: probe.tenantId,
        entityId: probe.id
      });

      return context.json({
        id: probe.id,
        tenantId: probe.tenantId,
        label: probe.label
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/audit/events", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "audit.read", {
        entityType: "auditEvent",
        tenantId: session.user.tenantId
      });

      return context.json({
        events: runtime.auditStore.listByTenant(session.user.tenantId).map(auditEventDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/crm/accounts", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.read", {
        entityType: "account",
        tenantId: session.user.tenantId
      });

      return context.json({
        accounts: phase3Runtime.listAccounts(session.user.tenantId).map(accountDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/crm/accounts", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.write", {
        entityType: "account",
        tenantId: session.user.tenantId
      });

      const body: Phase3AccountCreateInput = accountCreateSchema.parse(await parseJson(context));
      const account = phase3Runtime.createAccount(session.user.tenantId, body);

      return context.json({ account: accountDto(account) }, 201);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/crm/accounts/:accountId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.read", {
        entityType: "account",
        tenantId: session.user.tenantId,
        entityId: context.req.param("accountId")
      });

      const account = phase3Runtime.getAccount(session.user.tenantId, context.req.param("accountId"));
      if (account === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({ account: accountDto(account) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/crm/contacts", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.read", {
        entityType: "contact",
        tenantId: session.user.tenantId
      });

      return context.json({
        contacts: phase3Runtime.listContacts(session.user.tenantId).map(contactDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/crm/contacts", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.write", {
        entityType: "contact",
        tenantId: session.user.tenantId
      });

      const body: Phase3ContactCreateInput = contactCreateSchema.parse(await parseJson(context));
      const contact = phase3Runtime.createContact(session.user.tenantId, body);

      return context.json({ contact: contactDto(contact) }, 201);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/crm/contacts/:contactId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.read", {
        entityType: "contact",
        tenantId: session.user.tenantId,
        entityId: context.req.param("contactId")
      });

      const contact = phase3Runtime.getContact(session.user.tenantId, context.req.param("contactId"));
      if (contact === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({ contact: contactDto(contact) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/crm/opportunities", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.read", {
        entityType: "opportunity",
        tenantId: session.user.tenantId
      });

      return context.json({
        opportunities: phase3Runtime.listOpportunities(session.user.tenantId).map(opportunityDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/crm/opportunities", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.write", {
        entityType: "opportunity",
        tenantId: session.user.tenantId
      });

      const body: Phase3OpportunityCreateInput = createOpportunitySchema.parse(await parseJson(context));
      const opportunity = phase3Runtime.createOpportunity(session.user.tenantId, body);

      return context.json({ opportunity: opportunityDto(opportunity) }, 201);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/crm/opportunities/:opportunityId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.read", {
        entityType: "opportunity",
        tenantId: session.user.tenantId,
        entityId: context.req.param("opportunityId")
      });

      const opportunity = phase3Runtime.getOpportunity(session.user.tenantId, context.req.param("opportunityId"));
      if (opportunity === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({ opportunity: opportunityDto(opportunity) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/crm/opportunities/:opportunityId/readiness", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const opportunityId = context.req.param("opportunityId");
      assertAllowed(runtime, session, "crm.readiness.run", {
        entityType: "opportunity",
        tenantId: session.user.tenantId,
        entityId: opportunityId
      });
      emptyBodySchema.parse(await parseJson(context));

      const readiness = phase3Runtime.evaluateReadiness(session.user.tenantId, opportunityId);
      if (readiness === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({
        correlationId: `corr-readiness-${opportunityId}`,
        readiness
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/crm/opportunities/:opportunityId/template-match", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const opportunityId = context.req.param("opportunityId");
      assertAllowed(runtime, session, "crm.template_match.run", {
        entityType: "opportunity",
        tenantId: session.user.tenantId,
        entityId: opportunityId
      });
      emptyBodySchema.parse(await parseJson(context));

      const templateMatch = phase3Runtime.matchTemplate(session.user.tenantId, opportunityId);
      if (templateMatch === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({
        correlationId: `corr-template-match-${opportunityId}`,
        templateMatch
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/crm/opportunities/:opportunityId/feasibility", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const opportunityId = context.req.param("opportunityId");
      assertAllowed(runtime, session, "crm.feasibility.run", {
        entityType: "opportunity",
        tenantId: session.user.tenantId,
        entityId: opportunityId
      });
      emptyBodySchema.parse(await parseJson(context));

      const result = phase3Runtime.runFeasibility(session.user.tenantId, opportunityId);
      if (result === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({
        correlationId: `corr-feasibility-${opportunityId}`,
        ...result
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/crm/opportunities/:opportunityId/project-draft", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const opportunityId = context.req.param("opportunityId");
      assertAllowed(runtime, session, "project_draft.create", {
        entityType: "opportunity",
        tenantId: session.user.tenantId,
        entityId: opportunityId
      });
      emptyBodySchema.parse(await parseJson(context));
      if (phase3Runtime.getOpportunity(session.user.tenantId, opportunityId) === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json(
        errorDto("not_implemented", "Создание проектного черновика будет реализовано в P3-008"),
        501
      );
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/test-fixtures/reset", (context) => {
    if (!options.allowTestFixtureReset) {
      return context.json(errorDto("test_mode_only", "Сброс фикстур доступен только в тестовом режиме"), 403);
    }

    runtime = createPhase2RuntimeState();
    phase3Runtime = createPhase3CrmRuntimeState();
    return context.json({ status: "reset" });
  });

  return app;
}

export type ApiApp = ReturnType<typeof createApiApp>;

function hasModelErrorCode(error: Error): error is Error & { code: "validation_error" | "conflict" } {
  return "code" in error && (error.code === "validation_error" || error.code === "conflict");
}

function accountDto(account: {
  id: string;
  tenantId: string;
  displayName: string;
  legalName?: string;
  taxId?: string;
  createdAt: string;
}) {
  return {
    id: account.id,
    tenantId: account.tenantId,
    displayName: account.displayName,
    ...(account.legalName !== undefined ? { legalName: account.legalName } : {}),
    ...(account.taxId !== undefined ? { taxId: account.taxId } : {}),
    createdAt: account.createdAt
  };
}

function contactDto(contact: {
  id: string;
  tenantId: string;
  accountId?: string;
  displayName: string;
  email?: string;
  phone?: string;
  roleLabel?: string;
}) {
  return {
    id: contact.id,
    tenantId: contact.tenantId,
    ...(contact.accountId !== undefined ? { accountId: contact.accountId } : {}),
    displayName: contact.displayName,
    ...(contact.email !== undefined ? { email: contact.email } : {}),
    ...(contact.phone !== undefined ? { phone: contact.phone } : {}),
    ...(contact.roleLabel !== undefined ? { roleLabel: contact.roleLabel } : {})
  };
}

function opportunityDto(opportunity: {
  id: string;
  tenantId: string;
  title: string;
  stageSystemKey: string;
  accountId?: string;
  contactIds: string[];
  plannedStartDate: string;
  desiredFinishDate: string;
  expectedValue: { amount: number; currency: string };
  probability: number;
  categoryKey: string;
  typologyKey: string;
  scopeHints: Array<{ key: string; label: string; value: string | number | boolean }>;
  customFieldRefs: Array<{ definitionId: string; key: string }>;
  source: { type: "manual" };
  createdAt: string;
}) {
  return {
    id: opportunity.id,
    tenantId: opportunity.tenantId,
    title: opportunity.title,
    stageSystemKey: opportunity.stageSystemKey,
    ...(opportunity.accountId !== undefined ? { accountId: opportunity.accountId } : {}),
    contactIds: [...opportunity.contactIds],
    plannedStartDate: opportunity.plannedStartDate,
    desiredFinishDate: opportunity.desiredFinishDate,
    expectedValue: { ...opportunity.expectedValue },
    probability: opportunity.probability,
    categoryKey: opportunity.categoryKey,
    typologyKey: opportunity.typologyKey,
    scopeHints: opportunity.scopeHints.map((hint) => ({ ...hint })),
    customFieldRefs: opportunity.customFieldRefs.map((fieldRef) => ({ ...fieldRef })),
    source: { ...opportunity.source },
    createdAt: opportunity.createdAt
  };
}

function handleRouteError(context: Context, error: unknown) {
  if (error instanceof z.ZodError || (error instanceof Error && error.message === "invalid_json")) {
    return context.json(errorDto("validation_error", "Некорректный запрос"), 400);
  }

  if (error instanceof Error && error.message === "unauthenticated") {
    return context.json(errorDto("unauthenticated", "Требуется тестовый пользователь"), 401);
  }

  if (typeof error === "object" && error !== null && "code" in error && "status" in error) {
    const typedError = error as { code: ApiErrorCode; status: 403 };
    return context.json(errorDto(typedError.code, "Доступ запрещен"), typedError.status);
  }

  if (error instanceof Error && error.name === "TenantConfigModelError" && hasModelErrorCode(error)) {
    const code = error.code === "conflict" ? "conflict" : "validation_error";
    return context.json(
      errorDto(code, code === "conflict" ? "Конфликт версии конфигурации" : "Некорректный запрос"),
      code === "conflict" ? 409 : 400
    );
  }

  if (error instanceof Error && error.name === "AccessControlModelError" && hasModelErrorCode(error)) {
    const code = error.code === "conflict" ? "conflict" : "validation_error";
    return context.json(
      errorDto(code, code === "conflict" ? "Конфликт версии профиля доступа" : "Некорректный запрос"),
      code === "conflict" ? 409 : 400
    );
  }

  if (
    error instanceof Error &&
    (error.name === "CrmCoreModelError" ||
      error.name === "ProjectCoreModelError" ||
      error.name === "ResourcePlanningModelError") &&
    hasModelErrorCode(error)
  ) {
    const code = error.code === "conflict" ? "conflict" : "validation_error";
    return context.json(errorDto(code, "Некорректный запрос"), code === "conflict" ? 409 : 400);
  }

  if (typeof error === "object" && error !== null && "code" in error && error.code === "conflict") {
    return context.json(errorDto("conflict", "Конфликт данных"), 409);
  }

  return context.json(errorDto("validation_error", "Не удалось обработать запрос"), 400);
}

function resolveDiagnosticsTargetTenantId(
  runtime: Phase2RuntimeState,
  session: Phase2RuntimeSession,
  body: z.infer<typeof permissionDiagnosticsSchema>
): string | undefined {
  if (body.targetEntityType === "tenantIsolationProbe" && body.targetEntityId !== undefined) {
    return runtime.getProbe(body.targetEntityId)?.tenantId;
  }

  return body.targetTenantId ?? session.user.tenantId;
}
