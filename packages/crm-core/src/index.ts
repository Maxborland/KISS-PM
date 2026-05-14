import type { TenantId, TenantOwned } from "@kiss-pm/domain-core";

export const packageName = "@kiss-pm/crm-core";

export type AccountId = string;
export type ContactId = string;
export type OpportunityId = string;
export type OpportunityStageId = string;

export type OpportunitySource = {
  type: "manual";
};

export type OpportunityStage = TenantOwned & {
  id: OpportunityStageId;
  systemKey: string;
  label: string;
  sortOrder: number;
  active: boolean;
};

export type Account = TenantOwned & {
  id: AccountId;
  displayName: string;
  legalName?: string;
  taxId?: string;
  createdAt: string;
};

export type Contact = TenantOwned & {
  id: ContactId;
  accountId?: AccountId;
  displayName: string;
  email?: string;
  phone?: string;
  roleLabel?: string;
};

export type MoneyAmount = {
  amount: number;
  currency: string;
};

export type OpportunityScopeHintValue = string | number | boolean;

export type OpportunityScopeHint = {
  key: string;
  label: string;
  value: OpportunityScopeHintValue;
};

export type OpportunityCustomFieldRef = {
  definitionId: string;
  key: string;
};

export type Opportunity = TenantOwned & {
  id: OpportunityId;
  title: string;
  stageSystemKey: string;
  accountId?: AccountId;
  contactIds: ContactId[];
  plannedStartDate: string;
  desiredFinishDate: string;
  expectedValue: MoneyAmount;
  probability: number;
  categoryKey: string;
  typologyKey: string;
  scopeHints: OpportunityScopeHint[];
  customFieldRefs: OpportunityCustomFieldRef[];
  source: OpportunitySource;
  createdAt: string;
};

export type OpportunityReadinessBlockerCode =
  | "account_or_contact_missing"
  | "planned_dates_missing"
  | "date_window_invalid"
  | "category_missing"
  | "typology_missing"
  | "scope_hints_missing"
  | "template_match_missing"
  | "low_confidence";

export type OpportunityReadinessBlockerSeverity = "blocking" | "warning";

export type OpportunityReadinessNextAction =
  | "collect_missing_data"
  | "select_process_template"
  | "improve_confidence"
  | "run_feasibility";

export type OpportunityReadinessBlocker = {
  code: OpportunityReadinessBlockerCode;
  severity: OpportunityReadinessBlockerSeverity;
  message: string;
  fieldRefs: string[];
};

export type OpportunityTemplateMatchRef = {
  templateId: string;
  confidence: number;
};

export type OpportunityReadinessInput = {
  tenantId: TenantId;
  opportunityId?: OpportunityId;
  accountId?: AccountId;
  contactIds?: ContactId[];
  accountContactIntent?: "identified" | "intentionally_unknown";
  plannedStartDate?: string;
  desiredFinishDate?: string;
  categoryKey?: string;
  typologyKey?: string;
  scopeHints?: OpportunityScopeHint[];
  templateMatch?: OpportunityTemplateMatchRef;
  minimumTemplateConfidence?: number;
};

export type OpportunityReadinessCheck = TenantOwned & {
  opportunityId?: OpportunityId;
  ready: boolean;
  blockers: OpportunityReadinessBlocker[];
  nextAction: OpportunityReadinessNextAction;
  trace: string[];
};

export class CrmCoreModelError extends Error {
  constructor(
    readonly code: "validation_error" | "tenant_mismatch" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "CrmCoreModelError";
  }
}

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CrmCoreModelError("validation_error", `${fieldName} is required`);
  }

  return value;
}

function requirePositiveInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new CrmCoreModelError("validation_error", `${fieldName} must be a positive integer`);
  }

  return value;
}

function requireBoolean(value: boolean | undefined, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new CrmCoreModelError("validation_error", `${fieldName} must be a boolean`);
  }

  return value;
}

function requireValidTimestamp(value: string | undefined, fieldName: string): string {
  const timestamp = requireNonEmptyString(value, fieldName);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new CrmCoreModelError("validation_error", `${fieldName} must be a valid timestamp`);
  }

  return timestamp;
}

function requireIsoDate(value: string | undefined, fieldName: string): string {
  const date = requireNonEmptyString(value, fieldName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new CrmCoreModelError("validation_error", `${fieldName} must be an ISO date`);
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new CrmCoreModelError("validation_error", `${fieldName} must be a valid ISO date`);
  }

  return date;
}

function requireSystemKey(value: string | undefined, fieldName: string): string {
  const key = requireNonEmptyString(value, fieldName);
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(key)) {
    throw new CrmCoreModelError("validation_error", `${fieldName} must be a stable system key`);
  }

  return key;
}

function hasNonEmptyString(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isSystemKey(value: string | undefined): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(value);
}

function isValidIsoDate(value: string | undefined): value is string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function requireMoneyAmount(value: MoneyAmount | undefined): MoneyAmount {
  if (!value || typeof value.amount !== "number" || !Number.isFinite(value.amount) || value.amount <= 0) {
    throw new CrmCoreModelError("validation_error", "opportunity.expectedValue.amount must be positive");
  }
  if (!/^[A-Z]{3}$/.test(requireNonEmptyString(value.currency, "opportunity.expectedValue.currency"))) {
    throw new CrmCoreModelError("validation_error", "opportunity.expectedValue.currency must be an ISO currency code");
  }

  return {
    amount: value.amount,
    currency: value.currency
  };
}

function requireProbability(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new CrmCoreModelError("validation_error", "opportunity.probability must be between 0 and 1");
  }

  return value;
}

function requireArray<T>(value: T[] | undefined, fieldName: string): T[] {
  if (!Array.isArray(value)) {
    throw new CrmCoreModelError("validation_error", `${fieldName} must be an array`);
  }

  return value;
}

function requireObject<T extends object>(value: T | undefined, fieldName: string): T {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CrmCoreModelError("validation_error", `${fieldName} must be an object`);
  }

  return value;
}

function assertSameTenant(expectedTenantId: TenantId, entity: TenantOwned, fieldName: string): void {
  const tenantId = requireNonEmptyString(requireObject(entity, fieldName).tenantId, `${fieldName}.tenantId`);
  if (tenantId !== expectedTenantId) {
    throw new CrmCoreModelError("tenant_mismatch", "Tenant mismatch");
  }
}

function cloneScopeHints(scopeHints: OpportunityScopeHint[] | undefined): OpportunityScopeHint[] {
  return requireArray(scopeHints ?? [], "opportunity.scopeHints").map((rawHint) => {
    const hint = requireObject(rawHint, "opportunity.scopeHint");
    const value = hint.value;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      throw new CrmCoreModelError("validation_error", "opportunity.scopeHint.value is invalid");
    }

    return {
      key: requireSystemKey(hint.key, "opportunity.scopeHint.key"),
      label: requireNonEmptyString(hint.label, "opportunity.scopeHint.label"),
      value
    };
  });
}

function cloneCustomFieldRefs(customFieldRefs: OpportunityCustomFieldRef[] | undefined): OpportunityCustomFieldRef[] {
  return requireArray(customFieldRefs ?? [], "opportunity.customFieldRefs").map((rawFieldRef) => {
    const fieldRef = requireObject(rawFieldRef, "opportunity.customFieldRef");

    return {
      definitionId: requireNonEmptyString(fieldRef.definitionId, "opportunity.customFieldRef.definitionId"),
      key: requireSystemKey(fieldRef.key, "opportunity.customFieldRef.key")
    };
  });
}

function createReadinessBlocker(
  code: OpportunityReadinessBlockerCode,
  message: string,
  fieldRefs: string[]
): OpportunityReadinessBlocker {
  return {
    code,
    severity: "blocking",
    message,
    fieldRefs: [...fieldRefs]
  };
}

function selectReadinessNextAction(blockers: OpportunityReadinessBlocker[]): OpportunityReadinessNextAction {
  if (blockers.length === 0) return "run_feasibility";

  const blockerCodes = new Set(blockers.map((blocker) => blocker.code));
  const missingDataCodes: OpportunityReadinessBlockerCode[] = [
    "account_or_contact_missing",
    "planned_dates_missing",
    "date_window_invalid",
    "category_missing",
    "typology_missing",
    "scope_hints_missing"
  ];

  if (missingDataCodes.some((code) => blockerCodes.has(code))) return "collect_missing_data";
  if (blockerCodes.has("template_match_missing")) return "select_process_template";
  if (blockerCodes.has("low_confidence")) return "improve_confidence";

  return "collect_missing_data";
}

function validateOptionalStringArray(value: string[] | undefined, fieldName: string): string[] {
  return requireArray(value ?? [], fieldName).map((item) => requireNonEmptyString(item, `${fieldName}[]`));
}

export function evaluateOpportunityReadiness(input: OpportunityReadinessInput): OpportunityReadinessCheck {
  const tenantId = requireNonEmptyString(input.tenantId, "tenantId");
  const blockers: OpportunityReadinessBlocker[] = [];
  const trace: string[] = [];
  const contactIds = validateOptionalStringArray(input.contactIds, "readiness.contactIds");
  const scopeHints = cloneScopeHints(input.scopeHints);

  if (
    !hasNonEmptyString(input.accountId) &&
    contactIds.length === 0 &&
    input.accountContactIntent !== "intentionally_unknown"
  ) {
    blockers.push(
      createReadinessBlocker(
        "account_or_contact_missing",
        "Укажите клиента или контакт либо явно отметьте, что они пока неизвестны.",
        ["accountId", "contactIds", "accountContactIntent"]
      )
    );
  }

  if (!hasNonEmptyString(input.plannedStartDate) || !hasNonEmptyString(input.desiredFinishDate)) {
    blockers.push(
      createReadinessBlocker("planned_dates_missing", "Укажите плановый старт и желаемую дату завершения.", [
        "plannedStartDate",
        "desiredFinishDate"
      ])
    );
  } else if (!isValidIsoDate(input.plannedStartDate) || !isValidIsoDate(input.desiredFinishDate)) {
    blockers.push(
      createReadinessBlocker("planned_dates_missing", "Укажите плановые даты в формате ISO YYYY-MM-DD.", [
        "plannedStartDate",
        "desiredFinishDate"
      ])
    );
  } else if (input.desiredFinishDate < input.plannedStartDate) {
    blockers.push(
      createReadinessBlocker(
        "date_window_invalid",
        "Желаемая дата завершения должна быть не раньше планового старта.",
        ["plannedStartDate", "desiredFinishDate"]
      )
    );
  }

  if (!isSystemKey(input.categoryKey)) {
    blockers.push(createReadinessBlocker("category_missing", "Выберите категорию возможности.", ["categoryKey"]));
  }

  if (!isSystemKey(input.typologyKey)) {
    blockers.push(createReadinessBlocker("typology_missing", "Выберите типологию возможности.", ["typologyKey"]));
  }

  if (scopeHints.length === 0) {
    blockers.push(
      createReadinessBlocker("scope_hints_missing", "Добавьте хотя бы один признак объема работ.", ["scopeHints"])
    );
  }

  if (input.templateMatch === undefined) {
    blockers.push(
      createReadinessBlocker("template_match_missing", "Подберите процессный шаблон для оценки возможности.", [
        "templateMatch"
      ])
    );
  } else {
    const templateMatch = requireObject(input.templateMatch, "readiness.templateMatch");
    if (!hasNonEmptyString(templateMatch.templateId)) {
      blockers.push(
        createReadinessBlocker("template_match_missing", "Подберите процессный шаблон для оценки возможности.", [
          "templateMatch"
        ])
      );
    } else {
      const confidence = requireProbability(templateMatch.confidence);
      const minimumConfidence = input.minimumTemplateConfidence ?? 0.5;
      const requiredConfidence = requireProbability(minimumConfidence);
      if (confidence < requiredConfidence) {
        blockers.push(
          createReadinessBlocker(
            "low_confidence",
            "Уточните данные возможности: уверенность подбора шаблона ниже допустимого порога.",
            ["templateMatch.confidence"]
          )
        );
      }
    }
  }

  const nextAction = selectReadinessNextAction(blockers);
  trace.push(blockers.length === 0 ? "readiness:ready" : `readiness:blockers:${blockers.length}`);
  trace.push(`readiness:next_action:${nextAction}`);

  return {
    tenantId,
    ...(input.opportunityId !== undefined ? { opportunityId: requireNonEmptyString(input.opportunityId, "opportunityId") } : {}),
    ready: blockers.length === 0,
    blockers,
    nextAction,
    trace
  };
}

export function createAccount(input: {
  id: AccountId;
  tenantId: TenantId;
  displayName: string;
  legalName?: string;
  taxId?: string;
  createdAt: string;
}): Account {
  return {
    id: requireNonEmptyString(input.id, "account.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    displayName: requireNonEmptyString(input.displayName, "account.displayName"),
    ...(input.legalName !== undefined ? { legalName: requireNonEmptyString(input.legalName, "account.legalName") } : {}),
    ...(input.taxId !== undefined ? { taxId: requireNonEmptyString(input.taxId, "account.taxId") } : {}),
    createdAt: requireValidTimestamp(input.createdAt, "account.createdAt")
  };
}

export function createContact(input: {
  id: ContactId;
  tenantId: TenantId;
  accountId?: AccountId;
  displayName: string;
  email?: string;
  phone?: string;
  roleLabel?: string;
}): Contact {
  return {
    id: requireNonEmptyString(input.id, "contact.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    ...(input.accountId !== undefined ? { accountId: requireNonEmptyString(input.accountId, "contact.accountId") } : {}),
    displayName: requireNonEmptyString(input.displayName, "contact.displayName"),
    ...(input.email !== undefined ? { email: requireNonEmptyString(input.email, "contact.email") } : {}),
    ...(input.phone !== undefined ? { phone: requireNonEmptyString(input.phone, "contact.phone") } : {}),
    ...(input.roleLabel !== undefined ? { roleLabel: requireNonEmptyString(input.roleLabel, "contact.roleLabel") } : {})
  };
}

export function createOpportunityStage(input: {
  id: OpportunityStageId;
  tenantId: TenantId;
  systemKey: string;
  label: string;
  sortOrder: number;
  active: boolean;
}): OpportunityStage {
  return {
    id: requireNonEmptyString(input.id, "opportunityStage.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    systemKey: requireSystemKey(input.systemKey, "opportunityStage.systemKey"),
    label: requireNonEmptyString(input.label, "opportunityStage.label"),
    sortOrder: requirePositiveInteger(input.sortOrder, "opportunityStage.sortOrder"),
    active: requireBoolean(input.active, "opportunityStage.active")
  };
}

export function createOpportunity(input: {
  id: OpportunityId;
  tenantId: TenantId;
  title: string;
  stage: OpportunityStage;
  account?: Account;
  contacts: Contact[];
  plannedStartDate: string;
  desiredFinishDate: string;
  expectedValue: MoneyAmount;
  probability: number;
  categoryKey: string;
  typologyKey: string;
  scopeHints?: OpportunityScopeHint[];
  customFieldRefs?: OpportunityCustomFieldRef[];
  createdAt: string;
}): Opportunity {
  const tenantId = requireNonEmptyString(input.tenantId, "tenantId");
  assertSameTenant(tenantId, input.stage, "opportunity.stage");
  const stageSystemKey = requireSystemKey(input.stage.systemKey, "opportunity.stage.systemKey");
  const stageActive = requireBoolean(input.stage.active, "opportunity.stage.active");
  if (!stageActive) {
    throw new CrmCoreModelError("validation_error", "opportunity.stage must be active");
  }
  if (input.account !== undefined) {
    assertSameTenant(tenantId, input.account, "opportunity.account");
  }

  const contactIds = requireArray(input.contacts, "opportunity.contacts").map((contact) => {
    assertSameTenant(tenantId, contact, "opportunity.contact");
    if (input.account !== undefined && contact.accountId !== undefined && contact.accountId !== input.account.id) {
      throw new CrmCoreModelError("tenant_mismatch", "Opportunity contact does not belong to the selected account");
    }
    return requireNonEmptyString(contact.id, "contact.id");
  });
  if (new Set(contactIds).size !== contactIds.length) {
    throw new CrmCoreModelError("conflict", "opportunity.contacts must be unique");
  }

  const plannedStartDate = requireIsoDate(input.plannedStartDate, "opportunity.plannedStartDate");
  const desiredFinishDate = requireIsoDate(input.desiredFinishDate, "opportunity.desiredFinishDate");
  const probability = requireProbability(input.probability);
  if (desiredFinishDate < plannedStartDate) {
    throw new CrmCoreModelError("validation_error", "opportunity.desiredFinishDate must be on or after plannedStartDate");
  }

  return {
    id: requireNonEmptyString(input.id, "opportunity.id"),
    tenantId,
    title: requireNonEmptyString(input.title, "opportunity.title"),
    stageSystemKey,
    ...(input.account !== undefined ? { accountId: input.account.id } : {}),
    contactIds,
    plannedStartDate,
    desiredFinishDate,
    expectedValue: requireMoneyAmount(input.expectedValue),
    probability,
    categoryKey: requireSystemKey(input.categoryKey, "opportunity.categoryKey"),
    typologyKey: requireSystemKey(input.typologyKey, "opportunity.typologyKey"),
    scopeHints: cloneScopeHints(input.scopeHints),
    customFieldRefs: cloneCustomFieldRefs(input.customFieldRefs),
    source: {
      type: "manual"
    },
    createdAt: requireValidTimestamp(input.createdAt, "opportunity.createdAt")
  };
}
