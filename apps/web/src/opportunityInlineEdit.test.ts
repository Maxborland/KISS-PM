import { describe, expect, it } from "vitest";

import type { Client, Contact, Opportunity } from "./api";
import {
  buildClientUpdateInput,
  buildContactUpdateInput,
  buildOpportunityUpdateInput
} from "./opportunityInlineEdit";

describe("opportunity inline edit input builders", () => {
  it("preserves the full opportunity update contract while patching one field", () => {
    const opportunity = makeOpportunity();

    expect(buildOpportunityUpdateInput(opportunity, { title: "Новый заголовок" })).toMatchObject({
      clientId: "client-1",
      primaryContactId: "contact-1",
      ownerUserId: "user-owner",
      projectTypeId: "type-1",
      stageId: "stage-1",
      title: "Новый заголовок",
      plannedStart: "2034-03-27",
      plannedFinish: "2034-04-26",
      contractValue: 960000,
      plannedHourlyRate: 6000,
      probability: 70,
      templateId: null,
      demand: [{ positionId: "pm", requiredHours: 80 }],
      customFieldValues: { priority: "Высокий" }
    });
  });

  it("preserves client and contact required update fields for inline edits", () => {
    const client: Client = {
      id: "client-1",
      tenantId: "tenant-1",
      name: "ООО Ромашка",
      description: null,
      status: "active",
      createdAt: "2026-05-20T00:00:00.000Z",
      updatedAt: "2026-05-20T00:00:00.000Z"
    };
    const contact: Contact = {
      id: "contact-1",
      tenantId: "tenant-1",
      clientId: "client-1",
      name: "Ирина Клиент",
      email: "irina@example.com",
      phone: null,
      telegram: null,
      role: "Заказчик",
      status: "active",
      createdAt: "2026-05-20T00:00:00.000Z",
      updatedAt: "2026-05-20T00:00:00.000Z"
    };

    expect(buildClientUpdateInput(client, { description: "Ключевой клиент" })).toEqual({
      name: "ООО Ромашка",
      description: "Ключевой клиент",
      status: "active"
    });
    expect(buildContactUpdateInput(contact, { phone: "+7 900 000-00-00" })).toEqual({
      clientId: "client-1",
      name: "Ирина Клиент",
      email: "irina@example.com",
      phone: "+7 900 000-00-00",
      telegram: null,
      role: "Заказчик",
      status: "active"
    });
  });
});

function makeOpportunity(): Opportunity {
  return {
    id: "opp-1",
    tenantId: "tenant-1",
    clientId: "client-1",
    primaryContactId: "contact-1",
    ownerUserId: "user-owner",
    projectTypeId: "type-1",
    stageId: "stage-1",
    clientName: "ООО Ромашка",
    contactName: "Ирина Клиент",
    title: "Контур внедрения",
    projectType: "Внедрение",
    description: null,
    plannedStart: "2034-03-27T00:00:00.000Z",
    plannedFinish: "2034-04-26T00:00:00.000Z",
    contractValue: 960000,
    plannedHourlyRate: 6000,
    plannedHours: 160,
    probability: 70,
    status: "new",
    templateId: null,
    feasibilityStatus: null,
    feasibilityResult: null,
    feasibilityCheckedAt: null,
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    demand: [{ positionId: "pm", requiredHours: 80 }],
    customFieldValues: { priority: "Высокий" }
  };
}
