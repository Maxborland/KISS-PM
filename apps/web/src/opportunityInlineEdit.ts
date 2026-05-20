import type {
  Client,
  ClientUpdateInput,
  Contact,
  ContactUpdateInput,
  Opportunity,
  OpportunityUpdateInput
} from "./api";

export function buildOpportunityUpdateInput(
  opportunity: Opportunity,
  patch: Partial<OpportunityUpdateInput>
): OpportunityUpdateInput {
  return {
    clientId: opportunity.clientId ?? "",
    primaryContactId: opportunity.primaryContactId ?? "",
    ownerUserId: opportunity.ownerUserId ?? null,
    projectTypeId: opportunity.projectTypeId ?? "",
    stageId: opportunity.stageId ?? "",
    title: opportunity.title,
    description: opportunity.description ?? "",
    plannedStart: toDateInputValue(opportunity.plannedStart),
    plannedFinish: toDateInputValue(opportunity.plannedFinish),
    contractValue: opportunity.contractValue,
    plannedHourlyRate: opportunity.plannedHourlyRate,
    probability: opportunity.probability,
    templateId: opportunity.templateId,
    demand: opportunity.demand,
    customFieldValues: opportunity.customFieldValues,
    ...withoutUndefined(patch)
  };
}

export function buildClientUpdateInput(
  client: Client,
  patch: Partial<ClientUpdateInput>
): ClientUpdateInput {
  return {
    name: client.name,
    description: client.description,
    status: client.status,
    ...withoutUndefined(patch)
  };
}

export function buildContactUpdateInput(
  contact: Contact,
  patch: Partial<ContactUpdateInput>
): ContactUpdateInput {
  return {
    clientId: contact.clientId,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    telegram: contact.telegram,
    role: contact.role,
    status: contact.status,
    ...withoutUndefined(patch)
  };
}

export function toDateInputValue(value: string | undefined): string {
  return value ? value.slice(0, 10) : "";
}

function withoutUndefined<T extends Record<string, unknown>>(input: Partial<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}
