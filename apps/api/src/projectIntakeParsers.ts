import { calculatePlannedHours } from "@kiss-pm/domain";
import type { TenantId } from "@kiss-pm/domain";
import type { OpportunityInput, OpportunityUpdateInput } from "./apiTypes";
import { getOptionalString } from "./parseHelpers";

type ParseResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: string;
    };

const idPattern = /^[a-z][a-z0-9-]{2,80}$/;
const maxPostgresInteger = 2_147_483_647;
const maxDemandRows = 12;
const maxDemandHours = 100_000;
const maxPlanningHorizonDays = 730;
const maxLengths = {
  clientName: 120,
  contactName: 120,
  title: 160,
  projectType: 80,
  description: 1_000
} as const;

export function parseOpportunityBody(
  body: unknown,
  tenantId: TenantId
): ParseResult<OpportunityInput> {
  const parsed = parseOpportunityFields(body, tenantId);
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    value: {
      id: parsed.value.id,
      ...parsed.value.fields,
      status: "new"
    }
  };
}

export function parseOpportunityUpdateBody(
  body: unknown,
  tenantId: TenantId
): ParseResult<OpportunityUpdateInput> {
  const parsed = parseOpportunityFields(body, tenantId);
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    value: parsed.value.fields
  };
}

function parseOpportunityFields(
  body: unknown,
  tenantId: TenantId
): ParseResult<{
  id: string;
  fields: OpportunityUpdateInput & Pick<OpportunityInput, "clientName" | "contactName" | "projectType">;
}> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body" };
  }

  const input = body as Record<string, unknown>;
  const id = getOptionalString(input, "id") ?? `opportunity-${crypto.randomUUID()}`;
  const clientId = getOptionalString(input, "clientId");
  const primaryContactId = getOptionalString(input, "primaryContactId");
  const projectTypeId = getOptionalString(input, "projectTypeId");
  const stageId = getOptionalString(input, "stageId");
  const clientName = getOptionalString(input, "clientName") ?? "";
  const contactName = getOptionalString(input, "contactName") ?? "";
  const title = getOptionalString(input, "title");
  const projectType = getOptionalString(input, "projectType") ?? "";
  const description = getOptionalString(input, "description") ?? "";
  const plannedStart = parseDate(input.plannedStart);
  const plannedFinish = parseDate(input.plannedFinish);
  const contractValue = parsePositiveInteger(input.contractValue);
  const plannedHourlyRate = parsePositiveInteger(input.plannedHourlyRate);
  const probability = parseProbability(input.probability);
  const templateId = getOptionalString(input, "templateId") ?? null;
  const demand = parseDemand(input.demand);

  if (!idPattern.test(id)) return { ok: false, error: "invalid_opportunity_id" };
  if (!clientId || !idPattern.test(clientId)) {
    return { ok: false, error: "invalid_client_id" };
  }
  if (!primaryContactId || !idPattern.test(primaryContactId)) {
    return { ok: false, error: "invalid_primary_contact_id" };
  }
  if (!projectTypeId || !idPattern.test(projectTypeId)) {
    return { ok: false, error: "invalid_project_type_id" };
  }
  if (!stageId || !idPattern.test(stageId)) {
    return { ok: false, error: "invalid_deal_stage_id" };
  }
  if (clientName.length > maxLengths.clientName) {
    return { ok: false, error: "invalid_client_name" };
  }
  if (contactName.length > maxLengths.contactName) {
    return { ok: false, error: "invalid_client_name" };
  }
  if (!title || title.length > maxLengths.title) {
    return { ok: false, error: "invalid_opportunity_title" };
  }
  if (projectType.length > maxLengths.projectType) {
    return { ok: false, error: "invalid_project_type" };
  }
  if (description.length > maxLengths.description) {
    return { ok: false, error: "invalid_description" };
  }
  if (templateId !== null && !idPattern.test(templateId)) {
    return { ok: false, error: "invalid_template_id" };
  }
  if (
    !plannedStart ||
    !plannedFinish ||
    plannedFinish.getTime() < plannedStart.getTime() ||
    getDateDiffDays(plannedStart, plannedFinish) > maxPlanningHorizonDays
  ) {
    return { ok: false, error: "invalid_planned_dates" };
  }
  if (contractValue === null) return { ok: false, error: "invalid_contract_value" };
  if (plannedHourlyRate === null) {
    return { ok: false, error: "invalid_planned_hourly_rate" };
  }
  if (probability === null) return { ok: false, error: "invalid_probability" };
  if (!demand.ok) return demand;

  return {
    ok: true,
    value: {
      id,
      fields: {
        tenantId,
        clientId,
        primaryContactId,
        projectTypeId,
        stageId,
        clientName,
        contactName,
        title,
        projectType,
        description: description || null,
        plannedStart,
        plannedFinish,
        contractValue,
        plannedHourlyRate,
        plannedHours: calculatePlannedHours(contractValue, plannedHourlyRate),
        probability,
        templateId,
        demand: demand.value
      }
    }
  };
}

export function parseProjectActivationBody(
  body: unknown
): ParseResult<{ id: string; acceptedRiskReason: string | null }> {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const id = getOptionalString(input, "id") ?? `project-${crypto.randomUUID()}`;
  const acceptedRiskReason = getOptionalString(input, "acceptedRiskReason") ?? null;

  if (!idPattern.test(id)) return { ok: false, error: "invalid_project_id" };
  if (acceptedRiskReason !== null && acceptedRiskReason.length > 500) {
    return { ok: false, error: "invalid_risk_reason" };
  }

  return {
    ok: true,
    value: {
      id,
      acceptedRiskReason: acceptedRiskReason || null
    }
  };
}

function parseDemand(value: unknown): ParseResult<OpportunityInput["demand"]> {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxDemandRows) {
    return { ok: false, error: "invalid_demand" };
  }

  const seenPositions = new Set<string>();
  const demand: OpportunityInput["demand"] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "invalid_demand" };
    }
    const line = item as Record<string, unknown>;
    const positionId = getOptionalString(line, "positionId");
    const requiredHours = parsePositiveInteger(line.requiredHours, maxDemandHours);

    if (!positionId || !idPattern.test(positionId)) {
      return { ok: false, error: "invalid_demand_position" };
    }
    if (requiredHours === null) {
      return { ok: false, error: "invalid_demand_hours" };
    }
    if (seenPositions.has(positionId)) {
      return { ok: false, error: "duplicate_demand_position" };
    }

    seenPositions.add(positionId);
    demand.push({ positionId, requiredHours });
  }

  return { ok: true, value: demand };
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function parsePositiveInteger(
  value: unknown,
  maxValue: number = maxPostgresInteger
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > maxValue
  ) {
    return null;
  }
  return value;
}

function parseProbability(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= 0 && value <= 100 ? value : null;
}

function getDateDiffDays(start: Date, finish: Date): number {
  return Math.floor((finish.getTime() - start.getTime()) / 86_400_000);
}
