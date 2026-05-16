import { ActionEngineModelError, executeCreateProjectDraftFromOpportunity } from "@kiss-pm/action-engine";
import type { ActionExecutionLog } from "@kiss-pm/action-engine";
import {
  createAccount as createCrmAccount,
  createContact as createCrmContact,
  createOpportunity as createCrmOpportunity,
  createOpportunityStage,
  evaluateOpportunityReadiness,
  matchOpportunityToProcessTemplate
} from "@kiss-pm/crm-core";
import type {
  Account,
  Contact,
  MoneyAmount,
  Opportunity,
  OpportunityCustomFieldRef,
  OpportunityReadinessCheck,
  OpportunityScopeHint,
  OpportunityStage,
  ProcessTemplateMatchResult
} from "@kiss-pm/crm-core";
import type { TenantId } from "@kiss-pm/domain-core";
import { createProjectProcessTemplateDraft } from "@kiss-pm/project-core";
import type { ProcessTemplate, ProjectDraft, ProjectProcessTemplateDraft } from "@kiss-pm/project-core";
import {
  assessCapacityFeasibility,
  createDemandTemplateProfile,
  createResourceReservation,
  createRoleCapacityBucket,
  estimateDemandFromTemplateMatch
} from "@kiss-pm/resource-planning";
import type {
  CapacityFeasibilityResult,
  DemandEstimate,
  DemandTemplateProfile,
  ResourceReservation,
  RoleCapacityBucket
} from "@kiss-pm/resource-planning";

const PHASE3_TIMESTAMP = "2026-05-14T20:40:00.000Z";

export type Phase3AccountCreateInput = {
  id?: string;
  displayName: string;
  legalName?: string;
  taxId?: string;
};

export type Phase3ContactCreateInput = {
  id?: string;
  accountId?: string;
  displayName: string;
  email?: string;
  phone?: string;
  roleLabel?: string;
};

export type Phase3OpportunityCreateInput = {
  id?: string;
  title: string;
  accountId?: string;
  contactIds?: string[];
  account?: Phase3AccountCreateInput;
  contacts?: Phase3ContactCreateInput[];
  plannedStartDate: string;
  desiredFinishDate: string;
  expectedValue: MoneyAmount;
  probability: number;
  categoryKey: string;
  typologyKey: string;
  scopeHints?: OpportunityScopeHint[];
  customFieldRefs?: OpportunityCustomFieldRef[];
};

export type Phase3FeasibilityBundle = {
  templateMatch: ProcessTemplateMatchResult;
  demandEstimate: DemandEstimate;
  feasibility: CapacityFeasibilityResult;
};

export type Phase3ProjectDraftCommandActor = {
  actorId: string;
  accessProfileId?: string;
};

export type Phase3ProjectDraftCommandResult = {
  correlationId: string;
  projectDraft: ProjectDraft;
  actionExecution: ActionExecutionLog;
};

export type Phase3CrmRuntimeState = ReturnType<typeof createPhase3CrmRuntimeState>;

function cloneAccount(account: Account): Account {
  return { ...account };
}

function cloneContact(contact: Contact): Contact {
  return { ...contact };
}

function cloneOpportunity(opportunity: Opportunity): Opportunity {
  return {
    ...opportunity,
    contactIds: [...opportunity.contactIds],
    scopeHints: opportunity.scopeHints.map((hint) => ({ ...hint })),
    customFieldRefs: opportunity.customFieldRefs.map((fieldRef) => ({ ...fieldRef })),
    expectedValue: { ...opportunity.expectedValue },
    source: { ...opportunity.source }
  };
}

function cloneProjectDraft(projectDraft: ProjectDraft): ProjectDraft {
  return {
    ...projectDraft,
    sourceOpportunity: {
      ...projectDraft.sourceOpportunity,
      contactIds: [...projectDraft.sourceOpportunity.contactIds]
    },
    processTemplate: {
      ...projectDraft.processTemplate,
      assumptions: projectDraft.processTemplate.assumptions.map((assumption) => ({ ...assumption }))
    },
    demand: {
      ...projectDraft.demand,
      stageRoleDemands: projectDraft.demand.stageRoleDemands.map((demand) => ({ ...demand }))
    },
    feasibility: {
      ...projectDraft.feasibility,
      expectedWindow: { ...projectDraft.feasibility.expectedWindow },
      blockerCodes: [...projectDraft.feasibility.blockerCodes]
    }
  };
}

function cloneActionExecution(actionExecution: ActionExecutionLog): ActionExecutionLog {
  return {
    ...actionExecution,
    source: { ...actionExecution.source },
    ...(actionExecution.target !== undefined ? { target: { ...actionExecution.target } } : {}),
    before: actionExecution.before === null ? null : structuredClone(actionExecution.before),
    after: actionExecution.after === null ? null : structuredClone(actionExecution.after),
    trace: [...actionExecution.trace]
  };
}

function createStage(tenantId: TenantId): OpportunityStage {
  return createOpportunityStage({
    id: `stage-qualified-${tenantId}`,
    tenantId,
    systemKey: "qualified",
    label: "Квалифицирована",
    sortOrder: 10,
    active: true
  });
}

function createIntegrationTemplate(tenantId: TenantId): ProjectProcessTemplateDraft {
  return createProjectProcessTemplateDraft({
    id: `process-template-integrations-${tenantId}`,
    tenantId,
    key: "implementation.integration_heavy",
    label: "Внедрение с интеграциями",
    categoryKeys: ["implementation"],
    typologyKeys: ["integration_heavy"],
    requiredScopeHintKeys: ["integrations_count", "modules_count"],
    optionalScopeHintKeys: [],
    baseConfidence: 0.7,
    priority: 10,
    active: true,
    version: 2,
    assumptions: [{ code: "integration_delivery", message: "Учтены интеграционные работы." }],
    updatedAt: PHASE3_TIMESTAMP
  });
}

function createIntegrationDemandProfile(tenantId: TenantId): DemandTemplateProfile {
  return createDemandTemplateProfile({
    id: `demand-profile-integrations-${tenantId}`,
    tenantId,
    templateKey: "implementation.integration_heavy",
    templateVersion: 2,
    scenarioKey: "baseline",
    scenarioLabel: "Базовый сценарий",
    formula: {
      key: "phase3.template_scope_linear",
      version: 1,
      label: "Базовая оценка по шаблону и признакам объема"
    },
    roleRules: [
      {
        stageKey: "delivery",
        stageLabel: "Поставка",
        roleKey: "solution_architect",
        roleLabel: "Архитектор решения",
        baseWorkHours: 80,
        scopeHintDrivers: [{ scopeHintKey: "modules_count", hoursPerUnit: 12 }],
        confidence: 0.82,
        sortOrder: 20,
        assumptions: []
      },
      {
        stageKey: "initiation",
        stageLabel: "Инициация",
        roleKey: "project_manager",
        roleLabel: "Руководитель проекта",
        baseWorkHours: 40,
        scopeHintDrivers: [{ scopeHintKey: "integrations_count", hoursPerUnit: 8 }],
        confidence: 0.86,
        sortOrder: 10,
        assumptions: []
      }
    ],
    updatedAt: PHASE3_TIMESTAMP
  });
}

function createSeedOpportunity(tenantId: TenantId, id: string, title: string): Opportunity {
  const stage = createStage(tenantId);
  const account = createCrmAccount({
    id: `account-${id}`,
    tenantId,
    displayName: tenantId === "tenant-a" ? "АКМЕ" : "Tenant B Account",
    createdAt: PHASE3_TIMESTAMP
  });
  const contact = createCrmContact({
    id: `contact-${id}`,
    tenantId,
    accountId: account.id,
    displayName: tenantId === "tenant-a" ? "Анна Иванова" : "Tenant B Contact"
  });

  return createCrmOpportunity({
    id,
    tenantId,
    title,
    stage,
    account,
    contacts: [contact],
    plannedStartDate: "2026-06-01",
    desiredFinishDate: "2026-06-30",
    expectedValue: { amount: 1_500_000, currency: "RUB" },
    probability: 0.75,
    categoryKey: "implementation",
    typologyKey: "integration_heavy",
    scopeHints: [
      { key: "integrations_count", label: "Количество интеграций", value: 3 },
      { key: "modules_count", label: "Количество модулей", value: 5 }
    ],
    customFieldRefs: [],
    createdAt: PHASE3_TIMESTAMP
  });
}

function createCapacityBuckets(tenantId: TenantId): RoleCapacityBucket[] {
  return [
    createRoleCapacityBucket({
      id: `capacity-pm-june-${tenantId}`,
      tenantId,
      roleKey: "project_manager",
      roleLabel: "Руководитель проекта",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      capacityHours: 80,
      committedHours: 0,
      sourceLabel: "Seed capacity / PM"
    }),
    createRoleCapacityBucket({
      id: `capacity-architect-june-${tenantId}`,
      tenantId,
      roleKey: "solution_architect",
      roleLabel: "Архитектор решения",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      capacityHours: 180,
      committedHours: 0,
      sourceLabel: "Seed capacity / architecture"
    })
  ];
}

function createReservations(tenantId: TenantId): ResourceReservation[] {
  return [
    createResourceReservation({
      id: `reservation-architecture-other-${tenantId}`,
      tenantId,
      sourceType: "opportunity",
      sourceId: "opportunity-other",
      roleKey: "solution_architect",
      roleLabel: "Архитектор решения",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      reservedHours: 30,
      status: "active",
      sourceLabel: "Другая возможность"
    })
  ];
}

export function createPhase3CrmRuntimeState() {
  const accounts = new Map<string, Account>();
  const contacts = new Map<string, Contact>();
  const opportunities = new Map<string, Opportunity>();
  const stages = new Map<TenantId, OpportunityStage>();
  const templates = new Map<TenantId, ProjectProcessTemplateDraft[]>();
  const demandProfiles = new Map<TenantId, DemandTemplateProfile>();
  const capacityBuckets = new Map<TenantId, RoleCapacityBucket[]>();
  const reservations = new Map<TenantId, ResourceReservation[]>();
  const projectDrafts = new Map<string, ProjectDraft>();
  const actionExecutions = new Map<string, ActionExecutionLog>();

  function seedTenant(tenantId: TenantId, opportunityId: string, title: string): void {
    stages.set(tenantId, createStage(tenantId));
    templates.set(tenantId, [createIntegrationTemplate(tenantId)]);
    demandProfiles.set(tenantId, createIntegrationDemandProfile(tenantId));
    capacityBuckets.set(tenantId, createCapacityBuckets(tenantId));
    reservations.set(tenantId, createReservations(tenantId));
    const opportunity = createSeedOpportunity(tenantId, opportunityId, title);
    if (opportunity.accountId !== undefined) {
      accounts.set(
        opportunity.accountId,
        createCrmAccount({
          id: opportunity.accountId,
          tenantId,
          displayName: tenantId === "tenant-a" ? "АКМЕ" : "Tenant B Account",
          createdAt: PHASE3_TIMESTAMP
        })
      );
    }
    for (const contactId of opportunity.contactIds) {
      contacts.set(
        contactId,
        createCrmContact({
          id: contactId,
          tenantId,
          ...(opportunity.accountId !== undefined ? { accountId: opportunity.accountId } : {}),
          displayName: tenantId === "tenant-a" ? "Анна Иванова" : "Tenant B Contact"
        })
      );
    }
    opportunities.set(opportunity.id, opportunity);
  }

  function assertNewId(map: Map<string, { tenantId: TenantId }>, id: string): void {
    if (map.has(id)) {
      throw Object.assign(new Error("conflict"), { code: "conflict" });
    }
  }

  function nextTenantEntityId(entityType: "account" | "contact" | "opportunity", tenantId: TenantId): string {
    const map = entityType === "account" ? accounts : entityType === "contact" ? contacts : opportunities;
    const tenantEntityCount = [...map.values()].filter((entity) => entity.tenantId === tenantId).length;
    return `${entityType}-${tenantId}-${tenantEntityCount + 1}`;
  }

  function assertTenantAccountReference(tenantId: TenantId, accountId: string): void {
    const account = accounts.get(accountId);
    if (account?.tenantId !== tenantId) {
      throw Object.assign(new Error("validation_error"), { code: "validation_error" });
    }
  }

  function getTenantContactReference(tenantId: TenantId, contactId: string): Contact {
    const contact = contacts.get(contactId);
    if (contact?.tenantId !== tenantId) {
      throw Object.assign(new Error("validation_error"), { code: "validation_error" });
    }

    return cloneContact(contact);
  }

  function assertExclusiveReferences(
    left: unknown,
    right: unknown,
    message = "validation_error"
  ): void {
    if (left !== undefined && right !== undefined) {
      throw Object.assign(new Error(message), { code: "validation_error" });
    }
  }

  function findProjectDraftByOpportunity(tenantId: TenantId, opportunityId: string): ProjectDraft | undefined {
    return [...projectDrafts.values()].find(
      (projectDraft) =>
        projectDraft.tenantId === tenantId && projectDraft.sourceOpportunity.opportunityId === opportunityId
    );
  }

  seedTenant("tenant-a", "opportunity-seed-ready", "Внедрение портала АКМЕ");
  seedTenant("tenant-b", "opportunity-b-private", "Tenant B private opportunity");

  return {
    listAccounts(tenantId: TenantId): Account[] {
      return [...accounts.values()]
        .filter((account) => account.tenantId === tenantId)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(cloneAccount);
    },

    getAccount(tenantId: TenantId, accountId: string): Account | undefined {
      const account = accounts.get(accountId);
      return account?.tenantId === tenantId ? cloneAccount(account) : undefined;
    },

    createAccount(tenantId: TenantId, input: Phase3AccountCreateInput): Account {
      const account = createCrmAccount({
        id: input.id ?? nextTenantEntityId("account", tenantId),
        tenantId,
        displayName: input.displayName,
        ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
        ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
        createdAt: PHASE3_TIMESTAMP
      });
      assertNewId(accounts, account.id);
      accounts.set(account.id, cloneAccount(account));

      return cloneAccount(account);
    },

    listContacts(tenantId: TenantId): Contact[] {
      return [...contacts.values()]
        .filter((contact) => contact.tenantId === tenantId)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(cloneContact);
    },

    getContact(tenantId: TenantId, contactId: string): Contact | undefined {
      const contact = contacts.get(contactId);
      return contact?.tenantId === tenantId ? cloneContact(contact) : undefined;
    },

    createContact(tenantId: TenantId, input: Phase3ContactCreateInput): Contact {
      if (input.accountId !== undefined) {
        assertTenantAccountReference(tenantId, input.accountId);
      }
      const contact = createCrmContact({
        id: input.id ?? nextTenantEntityId("contact", tenantId),
        tenantId,
        ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
        displayName: input.displayName,
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.roleLabel !== undefined ? { roleLabel: input.roleLabel } : {})
      });
      assertNewId(contacts, contact.id);
      contacts.set(contact.id, cloneContact(contact));

      return cloneContact(contact);
    },

    listOpportunities(tenantId: TenantId): Opportunity[] {
      return [...opportunities.values()]
        .filter((opportunity) => opportunity.tenantId === tenantId)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(cloneOpportunity);
    },

    getOpportunity(tenantId: TenantId, opportunityId: string): Opportunity | undefined {
      const opportunity = opportunities.get(opportunityId);
      return opportunity?.tenantId === tenantId ? cloneOpportunity(opportunity) : undefined;
    },

    createOpportunity(tenantId: TenantId, input: Phase3OpportunityCreateInput): Opportunity {
      const stage = stages.get(tenantId) ?? createStage(tenantId);
      assertExclusiveReferences(input.accountId, input.account);
      assertExclusiveReferences(input.contactIds, input.contacts);
      const account =
        input.accountId !== undefined
          ? this.getAccount(tenantId, input.accountId)
          : input.account !== undefined
          ? createCrmAccount({
              id: input.account.id ?? nextTenantEntityId("account", tenantId),
              tenantId,
              displayName: input.account.displayName,
              ...(input.account.legalName !== undefined ? { legalName: input.account.legalName } : {}),
              ...(input.account.taxId !== undefined ? { taxId: input.account.taxId } : {}),
              createdAt: PHASE3_TIMESTAMP
            })
          : undefined;
      if (input.accountId !== undefined && account === undefined) {
        throw Object.assign(new Error("validation_error"), { code: "validation_error" });
      }
      const contactInputs = input.contacts ?? [];
      const existingContacts = (input.contactIds ?? []).map((contactId) => getTenantContactReference(tenantId, contactId));
      const createdContacts = contactInputs.map((contact, index) => {
        const contactId = contact.id ?? `contact-${input.id ?? nextTenantEntityId("opportunity", tenantId)}-${index + 1}`;
        return createCrmContact({
          id: contactId,
          tenantId,
          ...(contact.accountId !== undefined
            ? { accountId: contact.accountId }
            : account !== undefined
              ? { accountId: account.id }
              : {}),
          displayName: contact.displayName,
          ...(contact.email !== undefined ? { email: contact.email } : {}),
          ...(contact.phone !== undefined ? { phone: contact.phone } : {}),
          ...(contact.roleLabel !== undefined ? { roleLabel: contact.roleLabel } : {})
        });
      });
      if (input.accountId === undefined && account !== undefined) {
        assertNewId(accounts, account.id);
      }
      for (const contact of createdContacts) {
        assertNewId(contacts, contact.id);
        if (account === undefined && contact.accountId !== undefined) {
          assertTenantAccountReference(tenantId, contact.accountId);
        }
      }
      const allContacts = [...existingContacts, ...createdContacts];
      const opportunity = createCrmOpportunity({
        id: input.id ?? nextTenantEntityId("opportunity", tenantId),
        tenantId,
        title: input.title,
        stage,
        ...(account !== undefined ? { account } : {}),
        contacts: allContacts,
        plannedStartDate: input.plannedStartDate,
        desiredFinishDate: input.desiredFinishDate,
        expectedValue: input.expectedValue,
        probability: input.probability,
        categoryKey: input.categoryKey,
        typologyKey: input.typologyKey,
        scopeHints: input.scopeHints ?? [],
        customFieldRefs: input.customFieldRefs ?? [],
        createdAt: PHASE3_TIMESTAMP
      });

      if (opportunities.has(opportunity.id)) {
        throw Object.assign(new Error("conflict"), { code: "conflict" });
      }
      if (input.accountId === undefined && account !== undefined) accounts.set(account.id, cloneAccount(account));
      for (const contact of createdContacts) contacts.set(contact.id, cloneContact(contact));
      opportunities.set(opportunity.id, cloneOpportunity(opportunity));

      return cloneOpportunity(opportunity);
    },

    evaluateReadiness(tenantId: TenantId, opportunityId: string): OpportunityReadinessCheck | undefined {
      const opportunity = this.getOpportunity(tenantId, opportunityId);
      if (opportunity === undefined) return undefined;
      const templateMatch = this.matchTemplate(tenantId, opportunityId);

      return evaluateOpportunityReadiness({
        tenantId,
        opportunityId: opportunity.id,
        accountId: opportunity.accountId,
        contactIds: opportunity.contactIds,
        plannedStartDate: opportunity.plannedStartDate,
        desiredFinishDate: opportunity.desiredFinishDate,
        categoryKey: opportunity.categoryKey,
        typologyKey: opportunity.typologyKey,
        scopeHints: opportunity.scopeHints,
        templateMatch:
          templateMatch?.matched === true && templateMatch.template !== undefined
            ? { templateId: templateMatch.template.id, confidence: templateMatch.confidence }
            : undefined,
        minimumTemplateConfidence: 0.5
      });
    },

    matchTemplate(tenantId: TenantId, opportunityId: string): ProcessTemplateMatchResult | undefined {
      const opportunity = this.getOpportunity(tenantId, opportunityId);
      if (opportunity === undefined) return undefined;

      return matchOpportunityToProcessTemplate({
        opportunity,
        templates: templates.get(tenantId) ?? []
      });
    },

    replaceProcessTemplateForFutureIntake(template: ProcessTemplate): ProjectProcessTemplateDraft {
      const tenantTemplates = templates.get(template.tenantId);
      const currentTemplate = tenantTemplates?.find((candidate) => candidate.id === template.id);
      if (tenantTemplates === undefined || currentTemplate === undefined) {
        throw Object.assign(new Error("process template not found"), { code: "not_found" });
      }
      const nextTemplate = createProjectProcessTemplateDraft({
        ...currentTemplate,
        label: template.label,
        active: template.active,
        version: template.version,
        updatedAt: template.updatedAt
      });
      templates.set(
        template.tenantId,
        tenantTemplates.map((candidate) => (candidate.id === nextTemplate.id ? nextTemplate : candidate))
      );
      const currentDemandProfile = demandProfiles.get(template.tenantId);
      if (currentDemandProfile !== undefined && currentDemandProfile.templateKey === nextTemplate.key) {
        demandProfiles.set(
          template.tenantId,
          createDemandTemplateProfile({
            ...currentDemandProfile,
            templateVersion: nextTemplate.version
          })
        );
      }

      return nextTemplate;
    },

    runFeasibility(tenantId: TenantId, opportunityId: string): Phase3FeasibilityBundle | undefined {
      const opportunity = this.getOpportunity(tenantId, opportunityId);
      if (opportunity === undefined) return undefined;
      const templateMatch = this.matchTemplate(tenantId, opportunityId);
      const demandProfile = demandProfiles.get(tenantId);
      if (templateMatch === undefined || demandProfile === undefined) return undefined;
      const demandEstimate = estimateDemandFromTemplateMatch({
        tenantId,
        opportunityId,
        templateMatch,
        scopeHints: opportunity.scopeHints.map((hint) => ({
          tenantId,
          opportunityId,
          key: hint.key,
          label: hint.label,
          value: hint.value
        })),
        demandProfile
      });
      const feasibility = assessCapacityFeasibility({
        tenantId,
        opportunityId,
        expectedWindow: {
          startDate: opportunity.plannedStartDate,
          endDate: opportunity.desiredFinishDate
        },
        demandEstimate,
        capacityBuckets: capacityBuckets.get(tenantId) ?? [],
        reservations: reservations.get(tenantId) ?? []
      });

      return {
        templateMatch,
        demandEstimate,
        feasibility
      };
    },

    getProjectDraft(tenantId: TenantId, projectDraftId: string): ProjectDraft | undefined {
      const projectDraft = projectDrafts.get(projectDraftId);
      return projectDraft?.tenantId === tenantId ? cloneProjectDraft(projectDraft) : undefined;
    },

    listActionExecutions(tenantId: TenantId): ActionExecutionLog[] {
      return [...actionExecutions.values()]
        .filter((actionExecution) => actionExecution.tenantId === tenantId)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(cloneActionExecution);
    },

    createProjectDraftFromOpportunity(
      tenantId: TenantId,
      opportunityId: string,
      actor: Phase3ProjectDraftCommandActor
    ): Phase3ProjectDraftCommandResult | undefined {
      const opportunity = this.getOpportunity(tenantId, opportunityId);
      if (opportunity === undefined) return undefined;
      const readiness = this.evaluateReadiness(tenantId, opportunityId);
      if (readiness === undefined) return undefined;
      if (!readiness.ready) {
        throw new ActionEngineModelError("precondition_failed", "Opportunity readiness is not complete");
      }
      const feasibilityBundle = this.runFeasibility(tenantId, opportunityId);
      if (feasibilityBundle === undefined) return undefined;
      const template = feasibilityBundle.templateMatch.template;
      if (feasibilityBundle.templateMatch.matched !== true || template === undefined) {
        return undefined;
      }
      const correlationId = `corr-project-draft-${opportunityId}`;
      const result = executeCreateProjectDraftFromOpportunity({
        actor: {
          tenantId,
          actorId: actor.actorId,
          ...(actor.accessProfileId !== undefined ? { accessProfileId: actor.accessProfileId } : {}),
          correlationId
        },
        requiredPermission: "project_draft.create",
        now: PHASE3_TIMESTAMP,
        readiness: {
          ready: readiness.ready,
          nextAction: readiness.nextAction,
          trace: readiness.trace
        },
        sourceOpportunity: {
          tenantId,
          type: "crm_opportunity",
          opportunityId: opportunity.id,
          title: opportunity.title,
          ...(opportunity.accountId !== undefined ? { accountId: opportunity.accountId } : {}),
          contactIds: opportunity.contactIds,
          plannedStartDate: opportunity.plannedStartDate,
          desiredFinishDate: opportunity.desiredFinishDate
        },
        processTemplate: {
          tenantId,
          templateId: template.id,
          key: template.key,
          label: template.label,
          version: template.version,
          matchConfidence: feasibilityBundle.templateMatch.confidence,
          assumptions: feasibilityBundle.templateMatch.assumptions
        },
        demand: {
          tenantId,
          totalPlannedWorkHours: feasibilityBundle.demandEstimate.totalPlannedWorkHours,
          scenarioKey: feasibilityBundle.demandEstimate.scenario.key,
          scenarioLabel: feasibilityBundle.demandEstimate.scenario.label,
          formulaKey: feasibilityBundle.demandEstimate.formula.key,
          formulaVersion: feasibilityBundle.demandEstimate.formula.version,
          confidence: feasibilityBundle.demandEstimate.confidence,
          stageRoleDemands: feasibilityBundle.demandEstimate.stageRoleDemands.map((demand) => ({
            stageKey: demand.stageKey,
            stageLabel: demand.stageLabel,
            roleKey: demand.roleKey,
            roleLabel: demand.roleLabel,
            plannedWorkHours: demand.plannedWorkHours
          }))
        },
        feasibility: {
          tenantId,
          status: feasibilityBundle.feasibility.status,
          severity: feasibilityBundle.feasibility.severity,
          expectedWindow: feasibilityBundle.feasibility.expectedWindow,
          blockerCodes: feasibilityBundle.feasibility.blockers.map((blocker) => blocker.code)
        },
        existingDraft: findProjectDraftByOpportunity(tenantId, opportunityId)
      });

      projectDrafts.set(result.projectDraft.id, cloneProjectDraft(result.projectDraft));
      actionExecutions.set(result.actionExecution.id, cloneActionExecution(result.actionExecution));

      return {
        correlationId,
        projectDraft: cloneProjectDraft(result.projectDraft),
        actionExecution: cloneActionExecution(result.actionExecution)
      };
    }
  };
}
