import { asc, and, eq } from "drizzle-orm";

import type { TenantId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import { clients, contacts, dealStages, projectTypes } from "./schema";

export type CrmEntityStatus = "active" | "archived";

export type ClientRecord = {
  id: string;
  tenantId: TenantId;
  name: string;
  description: string | null;
  status: CrmEntityStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ClientInput = Omit<ClientRecord, "createdAt" | "updatedAt">;

export type ContactRecord = {
  id: string;
  tenantId: TenantId;
  clientId: string;
  name: string;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  role: string | null;
  status: CrmEntityStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ContactInput = Omit<ContactRecord, "createdAt" | "updatedAt">;

export type ProjectTypeRecord = {
  id: string;
  tenantId: TenantId;
  name: string;
  description: string | null;
  status: CrmEntityStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectTypeInput = Omit<ProjectTypeRecord, "createdAt" | "updatedAt">;

export type DealStageRecord = {
  id: string;
  tenantId: TenantId;
  name: string;
  sortOrder: number;
  status: CrmEntityStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type DealStageInput = Omit<DealStageRecord, "createdAt" | "updatedAt">;

export type CrmRepository = {
  listClients(tenantId: TenantId): Promise<ClientRecord[]>;
  findClientById(tenantId: TenantId, clientId: string): Promise<ClientRecord | undefined>;
  createClient(input: ClientInput): Promise<ClientRecord>;
  updateClient(input: ClientInput): Promise<ClientRecord>;
  listContacts(tenantId: TenantId): Promise<ContactRecord[]>;
  findContactById(
    tenantId: TenantId,
    contactId: string
  ): Promise<ContactRecord | undefined>;
  createContact(input: ContactInput): Promise<ContactRecord>;
  updateContact(input: ContactInput): Promise<ContactRecord>;
  listProjectTypes(tenantId: TenantId): Promise<ProjectTypeRecord[]>;
  findProjectTypeById(
    tenantId: TenantId,
    projectTypeId: string
  ): Promise<ProjectTypeRecord | undefined>;
  createProjectType(input: ProjectTypeInput): Promise<ProjectTypeRecord>;
  updateProjectType(input: ProjectTypeInput): Promise<ProjectTypeRecord>;
  listDealStages(tenantId: TenantId): Promise<DealStageRecord[]>;
  findDealStageById(
    tenantId: TenantId,
    stageId: string
  ): Promise<DealStageRecord | undefined>;
  createDealStage(input: DealStageInput): Promise<DealStageRecord>;
  updateDealStage(input: DealStageInput): Promise<DealStageRecord>;
};

export function createCrmRepository(db: KissPmDatabase): CrmRepository {
  return {
    async listClients(tenantId) {
      const rows = await db
        .select()
        .from(clients)
        .where(eq(clients.tenantId, tenantId))
        .orderBy(asc(clients.name));
      return rows.map(mapClientRecord);
    },
    async findClientById(tenantId, clientId) {
      const [row] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.tenantId, tenantId), eq(clients.id, clientId)))
        .limit(1);
      return row ? mapClientRecord(row) : undefined;
    },
    async createClient(input) {
      const now = new Date();
      const [row] = await db
        .insert(clients)
        .values({ ...input, createdAt: now, updatedAt: now })
        .returning();
      if (!row) throw new Error("Client insert returned no row");
      return mapClientRecord(row);
    },
    async updateClient(input) {
      const [row] = await db
        .update(clients)
        .set({
          name: input.name,
          description: input.description,
          status: input.status,
          updatedAt: new Date()
        })
        .where(and(eq(clients.tenantId, input.tenantId), eq(clients.id, input.id)))
        .returning();
      if (!row) throw new Error("Client update returned no row");
      return mapClientRecord(row);
    },
    async listContacts(tenantId) {
      const rows = await db
        .select()
        .from(contacts)
        .where(eq(contacts.tenantId, tenantId))
        .orderBy(asc(contacts.name));
      return rows.map(mapContactRecord);
    },
    async findContactById(tenantId, contactId) {
      const [row] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
        .limit(1);
      return row ? mapContactRecord(row) : undefined;
    },
    async createContact(input) {
      const now = new Date();
      const [row] = await db
        .insert(contacts)
        .values({ ...input, createdAt: now, updatedAt: now })
        .returning();
      if (!row) throw new Error("Contact insert returned no row");
      return mapContactRecord(row);
    },
    async updateContact(input) {
      const [row] = await db
        .update(contacts)
        .set({
          clientId: input.clientId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          telegram: input.telegram,
          role: input.role,
          status: input.status,
          updatedAt: new Date()
        })
        .where(and(eq(contacts.tenantId, input.tenantId), eq(contacts.id, input.id)))
        .returning();
      if (!row) throw new Error("Contact update returned no row");
      return mapContactRecord(row);
    },
    async listProjectTypes(tenantId) {
      const rows = await db
        .select()
        .from(projectTypes)
        .where(eq(projectTypes.tenantId, tenantId))
        .orderBy(asc(projectTypes.name));
      return rows.map(mapProjectTypeRecord);
    },
    async findProjectTypeById(tenantId, projectTypeId) {
      const [row] = await db
        .select()
        .from(projectTypes)
        .where(
          and(eq(projectTypes.tenantId, tenantId), eq(projectTypes.id, projectTypeId))
        )
        .limit(1);
      return row ? mapProjectTypeRecord(row) : undefined;
    },
    async createProjectType(input) {
      const now = new Date();
      const [row] = await db
        .insert(projectTypes)
        .values({ ...input, createdAt: now, updatedAt: now })
        .returning();
      if (!row) throw new Error("Project type insert returned no row");
      return mapProjectTypeRecord(row);
    },
    async updateProjectType(input) {
      const [row] = await db
        .update(projectTypes)
        .set({
          name: input.name,
          description: input.description,
          status: input.status,
          updatedAt: new Date()
        })
        .where(
          and(eq(projectTypes.tenantId, input.tenantId), eq(projectTypes.id, input.id))
        )
        .returning();
      if (!row) throw new Error("Project type update returned no row");
      return mapProjectTypeRecord(row);
    },
    async listDealStages(tenantId) {
      const rows = await db
        .select()
        .from(dealStages)
        .where(eq(dealStages.tenantId, tenantId))
        .orderBy(asc(dealStages.sortOrder), asc(dealStages.name));
      return rows.map(mapDealStageRecord);
    },
    async findDealStageById(tenantId, stageId) {
      const [row] = await db
        .select()
        .from(dealStages)
        .where(and(eq(dealStages.tenantId, tenantId), eq(dealStages.id, stageId)))
        .limit(1);
      return row ? mapDealStageRecord(row) : undefined;
    },
    async createDealStage(input) {
      const now = new Date();
      const [row] = await db
        .insert(dealStages)
        .values({ ...input, createdAt: now, updatedAt: now })
        .returning();
      if (!row) throw new Error("Deal stage insert returned no row");
      return mapDealStageRecord(row);
    },
    async updateDealStage(input) {
      const [row] = await db
        .update(dealStages)
        .set({
          name: input.name,
          sortOrder: input.sortOrder,
          status: input.status,
          updatedAt: new Date()
        })
        .where(and(eq(dealStages.tenantId, input.tenantId), eq(dealStages.id, input.id)))
        .returning();
      if (!row) throw new Error("Deal stage update returned no row");
      return mapDealStageRecord(row);
    }
  };
}

function mapClientRecord(row: typeof clients.$inferSelect): ClientRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    status: row.status as CrmEntityStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapContactRecord(row: typeof contacts.$inferSelect): ContactRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    clientId: row.clientId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    telegram: row.telegram,
    role: row.role,
    status: row.status as CrmEntityStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapProjectTypeRecord(row: typeof projectTypes.$inferSelect): ProjectTypeRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    status: row.status as CrmEntityStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapDealStageRecord(row: typeof dealStages.$inferSelect): DealStageRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    sortOrder: row.sortOrder,
    status: row.status as CrmEntityStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
