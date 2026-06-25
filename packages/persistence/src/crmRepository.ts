import { asc, and, eq } from "drizzle-orm";

import {
  buildCrmPipelineLifecycleGraph,
  type CrmPipeline,
  type CrmPipelineStage,
  type CrmPipelineStageAutomationDefinition,
  type CrmPipelineTransitionRule,
  type TenantId
} from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import {
  clients,
  contacts,
  crmPipelineStageAutomationDefinitions,
  crmPipelineStages,
  crmPipelineTransitionRules,
  crmPipelines,
  products,
  projectTypes
} from "./schema";

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

export type ProductType = "service" | "goods";

export type ProductRecord = {
  id: string;
  tenantId: TenantId;
  name: string;
  sku: string | null;
  type: ProductType;
  unit: string;
  price: number;
  description: string | null;
  status: CrmEntityStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductInput = Omit<ProductRecord, "createdAt" | "updatedAt">;

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

// DealStageRecord — веб-/legacy-проекция стадии поверх канонической crm_pipeline_stages
// (мультиворонки: стадия всегда принадлежит воронке, pipelineId не nullable).
export type DealStageRecord = {
  id: string;
  tenantId: TenantId;
  pipelineId: string;
  name: string;
  sortOrder: number;
  status: CrmEntityStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type DealStageInput = Omit<DealStageRecord, "createdAt" | "updatedAt">;

// PipelineRecord — операционная проекция воронки поверх crm_pipelines (без derived lifecycle-графа).
export type PipelineRecord = {
  id: string;
  tenantId: TenantId;
  name: string;
  description: string | null;
  isDefault: boolean;
  sortOrder: number;
  status: CrmEntityStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type PipelineInput = Omit<PipelineRecord, "createdAt" | "updatedAt">;

// StageTransitionRecord — runtime-гвард-проекция поверх crm_pipeline_transition_rules.
export type StageTransitionRecord = {
  id: string;
  tenantId: TenantId;
  pipelineId: string;
  fromStageId: string;
  toStageId: string;
  requireFeasibilityOk: boolean;
  minProbability: number | null;
  guardNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StageTransitionInput = Omit<StageTransitionRecord, "createdAt" | "updatedAt">;

export type CrmPipelineInput = Omit<CrmPipeline, "createdAt" | "updatedAt">;
export type CrmPipelineStageInput = Omit<CrmPipelineStage, "createdAt" | "updatedAt">;
export type CrmPipelineTransitionRuleInput = Omit<
  CrmPipelineTransitionRule,
  "createdAt" | "updatedAt"
>;
export type CrmPipelineStageAutomationDefinitionInput = Omit<
  CrmPipelineStageAutomationDefinition,
  "createdAt" | "updatedAt"
>;

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
  listProducts(tenantId: TenantId): Promise<ProductRecord[]>;
  findProductById(
    tenantId: TenantId,
    productId: string
  ): Promise<ProductRecord | undefined>;
  createProduct(input: ProductInput): Promise<ProductRecord>;
  updateProduct(input: ProductInput): Promise<ProductRecord>;
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
  listPipelines(tenantId: TenantId): Promise<PipelineRecord[]>;
  findPipelineById(
    tenantId: TenantId,
    pipelineId: string
  ): Promise<PipelineRecord | undefined>;
  createPipeline(input: PipelineInput): Promise<PipelineRecord>;
  updatePipeline(input: PipelineInput): Promise<PipelineRecord>;
  listStageTransitions(
    tenantId: TenantId,
    pipelineId?: string
  ): Promise<StageTransitionRecord[]>;
  findStageTransitionById(
    tenantId: TenantId,
    transitionId: string
  ): Promise<StageTransitionRecord | undefined>;
  createStageTransition(input: StageTransitionInput): Promise<StageTransitionRecord>;
  deleteStageTransition(tenantId: TenantId, transitionId: string): Promise<void>;
  listCrmPipelines(tenantId: TenantId): Promise<CrmPipeline[]>;
  findCrmPipelineById(tenantId: TenantId, pipelineId: string): Promise<CrmPipeline | undefined>;
  createCrmPipeline(input: CrmPipelineInput): Promise<CrmPipeline>;
  updateCrmPipeline(input: CrmPipelineInput): Promise<CrmPipeline>;
  refreshCrmPipelineLifecycleGraph(tenantId: TenantId, pipelineId: string): Promise<CrmPipeline | undefined>;
  listCrmPipelineStages(tenantId: TenantId, pipelineId?: string): Promise<CrmPipelineStage[]>;
  findCrmPipelineStageById(tenantId: TenantId, pipelineId: string, stageId: string): Promise<CrmPipelineStage | undefined>;
  createCrmPipelineStage(input: CrmPipelineStageInput): Promise<CrmPipelineStage>;
  updateCrmPipelineStage(input: CrmPipelineStageInput): Promise<CrmPipelineStage>;
  listCrmPipelineTransitionRules(tenantId: TenantId, pipelineId: string): Promise<CrmPipelineTransitionRule[]>;
  findCrmPipelineTransitionRuleById(tenantId: TenantId, pipelineId: string, ruleId: string): Promise<CrmPipelineTransitionRule | undefined>;
  createCrmPipelineTransitionRule(input: CrmPipelineTransitionRuleInput): Promise<CrmPipelineTransitionRule>;
  updateCrmPipelineTransitionRule(input: CrmPipelineTransitionRuleInput): Promise<CrmPipelineTransitionRule>;
  listCrmPipelineStageAutomationDefinitions(tenantId: TenantId, pipelineId: string): Promise<CrmPipelineStageAutomationDefinition[]>;
  findCrmPipelineStageAutomationDefinitionById(tenantId: TenantId, pipelineId: string, automationId: string): Promise<CrmPipelineStageAutomationDefinition | undefined>;
  createCrmPipelineStageAutomationDefinition(input: CrmPipelineStageAutomationDefinitionInput): Promise<CrmPipelineStageAutomationDefinition>;
  updateCrmPipelineStageAutomationDefinition(input: CrmPipelineStageAutomationDefinitionInput): Promise<CrmPipelineStageAutomationDefinition>;
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
    async listProducts(tenantId) {
      const rows = await db
        .select()
        .from(products)
        .where(eq(products.tenantId, tenantId))
        .orderBy(asc(products.name));
      return rows.map(mapProductRecord);
    },
    async findProductById(tenantId, productId) {
      const [row] = await db
        .select()
        .from(products)
        .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
        .limit(1);
      return row ? mapProductRecord(row) : undefined;
    },
    async createProduct(input) {
      const now = new Date();
      const [row] = await db
        .insert(products)
        .values({ ...input, createdAt: now, updatedAt: now })
        .returning();
      if (!row) throw new Error("Product insert returned no row");
      return mapProductRecord(row);
    },
    async updateProduct(input) {
      const [row] = await db
        .update(products)
        .set({
          name: input.name,
          sku: input.sku,
          type: input.type,
          unit: input.unit,
          price: input.price,
          description: input.description,
          status: input.status,
          updatedAt: new Date()
        })
        .where(and(eq(products.tenantId, input.tenantId), eq(products.id, input.id)))
        .returning();
      if (!row) throw new Error("Product update returned no row");
      return mapProductRecord(row);
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
        .from(crmPipelineStages)
        .where(eq(crmPipelineStages.tenantId, tenantId))
        .orderBy(asc(crmPipelineStages.sortOrder), asc(crmPipelineStages.name));
      return rows.map(mapDealStageRecord);
    },
    async findDealStageById(tenantId, stageId) {
      const [row] = await db
        .select()
        .from(crmPipelineStages)
        .where(and(eq(crmPipelineStages.tenantId, tenantId), eq(crmPipelineStages.id, stageId)))
        .limit(1);
      return row ? mapDealStageRecord(row) : undefined;
    },
    async createDealStage(input) {
      const now = new Date();
      const [row] = await db
        .insert(crmPipelineStages)
        .values({ ...input, createdAt: now, updatedAt: now })
        .returning();
      if (!row) throw new Error("Deal stage insert returned no row");
      return mapDealStageRecord(row);
    },
    async updateDealStage(input) {
      const [row] = await db
        .update(crmPipelineStages)
        .set({
          pipelineId: input.pipelineId,
          name: input.name,
          sortOrder: input.sortOrder,
          status: input.status,
          updatedAt: new Date()
        })
        .where(and(eq(crmPipelineStages.tenantId, input.tenantId), eq(crmPipelineStages.id, input.id)))
        .returning();
      if (!row) throw new Error("Deal stage update returned no row");
      return mapDealStageRecord(row);
    },
    async listPipelines(tenantId) {
      const rows = await db
        .select()
        .from(crmPipelines)
        .where(eq(crmPipelines.tenantId, tenantId))
        .orderBy(asc(crmPipelines.sortOrder));
      return rows.map(mapPipelineRecord);
    },
    async findPipelineById(tenantId, pipelineId) {
      const [row] = await db
        .select()
        .from(crmPipelines)
        .where(and(eq(crmPipelines.tenantId, tenantId), eq(crmPipelines.id, pipelineId)))
        .limit(1);
      return row ? mapPipelineRecord(row) : undefined;
    },
    async createPipeline(input) {
      const now = new Date();
      const [row] = await db
        .insert(crmPipelines)
        .values({
          ...input,
          // Пустой derived-граф при создании; пересобирается на изменениях стадий/правил.
          lifecycleGraphMetadata: {
            pipelineId: input.id,
            initialStageId: null,
            finalStageIds: [],
            stages: [],
            transitions: []
          },
          createdAt: now,
          updatedAt: now
        })
        .returning();
      if (!row) throw new Error("Pipeline insert returned no row");
      return mapPipelineRecord(row);
    },
    async updatePipeline(input) {
      const [row] = await db
        .update(crmPipelines)
        .set({
          name: input.name,
          description: input.description,
          isDefault: input.isDefault,
          sortOrder: input.sortOrder,
          status: input.status,
          updatedAt: new Date()
        })
        .where(and(eq(crmPipelines.tenantId, input.tenantId), eq(crmPipelines.id, input.id)))
        .returning();
      if (!row) throw new Error("Pipeline update returned no row");
      return mapPipelineRecord(row);
    },
    async listStageTransitions(tenantId, pipelineId) {
      const where = pipelineId
        ? and(
            eq(crmPipelineTransitionRules.tenantId, tenantId),
            eq(crmPipelineTransitionRules.pipelineId, pipelineId)
          )
        : eq(crmPipelineTransitionRules.tenantId, tenantId);
      const rows = await db
        .select()
        .from(crmPipelineTransitionRules)
        .where(where)
        .orderBy(asc(crmPipelineTransitionRules.createdAt));
      return rows.map(mapStageTransitionRecord);
    },
    async findStageTransitionById(tenantId, transitionId) {
      const [row] = await db
        .select()
        .from(crmPipelineTransitionRules)
        .where(
          and(
            eq(crmPipelineTransitionRules.tenantId, tenantId),
            eq(crmPipelineTransitionRules.id, transitionId)
          )
        )
        .limit(1);
      return row ? mapStageTransitionRecord(row) : undefined;
    },
    async createStageTransition(input) {
      const now = new Date();
      const [row] = await db
        .insert(crmPipelineTransitionRules)
        .values({
          ...input,
          // Governance-поля базы дефолтятся: runtime-гвард-правило не задаёт permission/required-fields/reason.
          requiredPermission: null,
          requiredFields: [],
          requireReason: false,
          createdAt: now,
          updatedAt: now
        })
        .returning();
      if (!row) throw new Error("Stage transition insert returned no row");
      return mapStageTransitionRecord(row);
    },
    async deleteStageTransition(tenantId, transitionId) {
      await db
        .delete(crmPipelineTransitionRules)
        .where(
          and(
            eq(crmPipelineTransitionRules.tenantId, tenantId),
            eq(crmPipelineTransitionRules.id, transitionId)
          )
        );
    },
    async listCrmPipelines(tenantId) {
      const rows = await db
        .select()
        .from(crmPipelines)
        .where(eq(crmPipelines.tenantId, tenantId))
        .orderBy(asc(crmPipelines.name));
      return rows.map(mapCrmPipelineRecord);
    },
    async findCrmPipelineById(tenantId, pipelineId) {
      const [row] = await db
        .select()
        .from(crmPipelines)
        .where(and(eq(crmPipelines.tenantId, tenantId), eq(crmPipelines.id, pipelineId)))
        .limit(1);
      return row ? mapCrmPipelineRecord(row) : undefined;
    },
    async createCrmPipeline(input) {
      const now = new Date();
      const [row] = await db
        .insert(crmPipelines)
        .values({ ...input, createdAt: now, updatedAt: now })
        .returning();
      if (!row) throw new Error("CRM pipeline insert returned no row");
      return mapCrmPipelineRecord(row);
    },
    async updateCrmPipeline(input) {
      const [row] = await db
        .update(crmPipelines)
        .set({
          name: input.name,
          // Унификация: операционные поля воронки должны сохраняться (иначе reorder/смена дефолта
          // принимаются с 200/аудитом, но БД не меняется).
          description: input.description,
          isDefault: input.isDefault,
          sortOrder: input.sortOrder,
          status: input.status,
          lifecycleGraphMetadata: input.lifecycleGraphMetadata,
          updatedAt: new Date()
        })
        .where(and(eq(crmPipelines.tenantId, input.tenantId), eq(crmPipelines.id, input.id)))
        .returning();
      if (!row) throw new Error("CRM pipeline update returned no row");
      return mapCrmPipelineRecord(row);
    },
    async refreshCrmPipelineLifecycleGraph(tenantId, pipelineId) {
      const [pipeline] = await db
        .select()
        .from(crmPipelines)
        .where(and(eq(crmPipelines.tenantId, tenantId), eq(crmPipelines.id, pipelineId)))
        .limit(1);
      if (!pipeline) return undefined;
      const stageRows = await db
        .select()
        .from(crmPipelineStages)
        .where(and(eq(crmPipelineStages.tenantId, tenantId), eq(crmPipelineStages.pipelineId, pipelineId)));
      const ruleRows = await db
        .select()
        .from(crmPipelineTransitionRules)
        .where(and(eq(crmPipelineTransitionRules.tenantId, tenantId), eq(crmPipelineTransitionRules.pipelineId, pipelineId)));
      const lifecycleGraphMetadata = buildCrmPipelineLifecycleGraph({
        pipelineId,
        stages: stageRows.map(mapCrmPipelineStageRecord),
        transitionRules: ruleRows.map(mapCrmPipelineTransitionRuleRecord)
      });
      const [row] = await db
        .update(crmPipelines)
        .set({ lifecycleGraphMetadata, updatedAt: new Date() })
        .where(and(eq(crmPipelines.tenantId, tenantId), eq(crmPipelines.id, pipelineId)))
        .returning();
      return row ? mapCrmPipelineRecord(row) : undefined;
    },
    async listCrmPipelineStages(tenantId, pipelineId) {
      // pipelineId опционален: без него — все стадии тенанта (нужно вебу /deal-stages для канбана по воронкам).
      const where = pipelineId
        ? and(eq(crmPipelineStages.tenantId, tenantId), eq(crmPipelineStages.pipelineId, pipelineId))
        : eq(crmPipelineStages.tenantId, tenantId);
      const rows = await db
        .select()
        .from(crmPipelineStages)
        .where(where)
        .orderBy(asc(crmPipelineStages.sortOrder), asc(crmPipelineStages.name));
      return rows.map(mapCrmPipelineStageRecord);
    },
    async findCrmPipelineStageById(tenantId, pipelineId, stageId) {
      const [row] = await db
        .select()
        .from(crmPipelineStages)
        .where(and(eq(crmPipelineStages.tenantId, tenantId), eq(crmPipelineStages.pipelineId, pipelineId), eq(crmPipelineStages.id, stageId)))
        .limit(1);
      return row ? mapCrmPipelineStageRecord(row) : undefined;
    },
    async createCrmPipelineStage(input) {
      const now = new Date();
      const [row] = await db
        .insert(crmPipelineStages)
        .values({ ...input, createdAt: now, updatedAt: now })
        .returning();
      if (!row) throw new Error("CRM pipeline stage insert returned no row");
      return mapCrmPipelineStageRecord(row);
    },
    async updateCrmPipelineStage(input) {
      const [row] = await db
        .update(crmPipelineStages)
        .set({
          name: input.name,
          sortOrder: input.sortOrder,
          status: input.status,
          lifecycleState: input.lifecycleState,
          isFinal: input.isFinal,
          updatedAt: new Date()
        })
        .where(and(eq(crmPipelineStages.tenantId, input.tenantId), eq(crmPipelineStages.pipelineId, input.pipelineId), eq(crmPipelineStages.id, input.id)))
        .returning();
      if (!row) throw new Error("CRM pipeline stage update returned no row");
      return mapCrmPipelineStageRecord(row);
    },
    async listCrmPipelineTransitionRules(tenantId, pipelineId) {
      const rows = await db
        .select()
        .from(crmPipelineTransitionRules)
        .where(and(eq(crmPipelineTransitionRules.tenantId, tenantId), eq(crmPipelineTransitionRules.pipelineId, pipelineId)))
        .orderBy(asc(crmPipelineTransitionRules.fromStageId), asc(crmPipelineTransitionRules.toStageId));
      return rows.map(mapCrmPipelineTransitionRuleRecord);
    },
    async findCrmPipelineTransitionRuleById(tenantId, pipelineId, ruleId) {
      const [row] = await db
        .select()
        .from(crmPipelineTransitionRules)
        .where(and(eq(crmPipelineTransitionRules.tenantId, tenantId), eq(crmPipelineTransitionRules.pipelineId, pipelineId), eq(crmPipelineTransitionRules.id, ruleId)))
        .limit(1);
      return row ? mapCrmPipelineTransitionRuleRecord(row) : undefined;
    },
    async createCrmPipelineTransitionRule(input) {
      const now = new Date();
      const [row] = await db
        .insert(crmPipelineTransitionRules)
        .values({ ...input, createdAt: now, updatedAt: now })
        .returning();
      if (!row) throw new Error("CRM pipeline transition rule insert returned no row");
      return mapCrmPipelineTransitionRuleRecord(row);
    },
    async updateCrmPipelineTransitionRule(input) {
      const [row] = await db
        .update(crmPipelineTransitionRules)
        .set({
          fromStageId: input.fromStageId,
          toStageId: input.toStageId,
          requiredPermission: input.requiredPermission,
          requiredFields: input.requiredFields,
          requireReason: input.requireReason,
          // Унификация: runtime-гварды должны сохраняться на update (иначе сбрасывались бы в дефолты).
          requireFeasibilityOk: input.requireFeasibilityOk,
          minProbability: input.minProbability,
          guardNote: input.guardNote,
          status: input.status,
          updatedAt: new Date()
        })
        .where(and(eq(crmPipelineTransitionRules.tenantId, input.tenantId), eq(crmPipelineTransitionRules.pipelineId, input.pipelineId), eq(crmPipelineTransitionRules.id, input.id)))
        .returning();
      if (!row) throw new Error("CRM pipeline transition rule update returned no row");
      return mapCrmPipelineTransitionRuleRecord(row);
    },
    async listCrmPipelineStageAutomationDefinitions(tenantId, pipelineId) {
      const rows = await db
        .select()
        .from(crmPipelineStageAutomationDefinitions)
        .where(and(eq(crmPipelineStageAutomationDefinitions.tenantId, tenantId), eq(crmPipelineStageAutomationDefinitions.pipelineId, pipelineId)))
        .orderBy(asc(crmPipelineStageAutomationDefinitions.stageId), asc(crmPipelineStageAutomationDefinitions.actionType));
      return rows.map(mapCrmPipelineStageAutomationDefinitionRecord);
    },
    async findCrmPipelineStageAutomationDefinitionById(tenantId, pipelineId, automationId) {
      const [row] = await db
        .select()
        .from(crmPipelineStageAutomationDefinitions)
        .where(and(eq(crmPipelineStageAutomationDefinitions.tenantId, tenantId), eq(crmPipelineStageAutomationDefinitions.pipelineId, pipelineId), eq(crmPipelineStageAutomationDefinitions.id, automationId)))
        .limit(1);
      return row ? mapCrmPipelineStageAutomationDefinitionRecord(row) : undefined;
    },
    async createCrmPipelineStageAutomationDefinition(input) {
      const now = new Date();
      const [row] = await db
        .insert(crmPipelineStageAutomationDefinitions)
        .values({ ...input, createdAt: now, updatedAt: now })
        .returning();
      if (!row) throw new Error("CRM pipeline automation insert returned no row");
      return mapCrmPipelineStageAutomationDefinitionRecord(row);
    },
    async updateCrmPipelineStageAutomationDefinition(input) {
      const [row] = await db
        .update(crmPipelineStageAutomationDefinitions)
        .set({
          stageId: input.stageId,
          trigger: input.trigger,
          actionType: input.actionType,
          actionConfig: input.actionConfig,
          status: input.status,
          updatedAt: new Date()
        })
        .where(and(eq(crmPipelineStageAutomationDefinitions.tenantId, input.tenantId), eq(crmPipelineStageAutomationDefinitions.pipelineId, input.pipelineId), eq(crmPipelineStageAutomationDefinitions.id, input.id)))
        .returning();
      if (!row) throw new Error("CRM pipeline automation update returned no row");
      return mapCrmPipelineStageAutomationDefinitionRecord(row);
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

function mapProductRecord(row: typeof products.$inferSelect): ProductRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    sku: row.sku,
    type: row.type as ProductType,
    unit: row.unit,
    price: row.price,
    description: row.description,
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

function mapDealStageRecord(row: typeof crmPipelineStages.$inferSelect): DealStageRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    pipelineId: row.pipelineId,
    name: row.name,
    sortOrder: row.sortOrder,
    status: row.status as CrmEntityStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapPipelineRecord(row: typeof crmPipelines.$inferSelect): PipelineRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    isDefault: row.isDefault,
    sortOrder: row.sortOrder,
    status: row.status as CrmEntityStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapCrmPipelineRecord(row: typeof crmPipelines.$inferSelect): CrmPipeline {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    isDefault: row.isDefault,
    sortOrder: row.sortOrder,
    status: row.status as CrmPipeline["status"],
    lifecycleGraphMetadata: row.lifecycleGraphMetadata as CrmPipeline["lifecycleGraphMetadata"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapStageTransitionRecord(
  row: typeof crmPipelineTransitionRules.$inferSelect
): StageTransitionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    pipelineId: row.pipelineId,
    fromStageId: row.fromStageId,
    toStageId: row.toStageId,
    requireFeasibilityOk: row.requireFeasibilityOk,
    minProbability: row.minProbability,
    guardNote: row.guardNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapCrmPipelineStageRecord(row: typeof crmPipelineStages.$inferSelect): CrmPipelineStage {
  return {
    id: row.id,
    tenantId: row.tenantId,
    pipelineId: row.pipelineId,
    name: row.name,
    sortOrder: row.sortOrder,
    status: row.status as CrmPipelineStage["status"],
    lifecycleState: row.lifecycleState as CrmPipelineStage["lifecycleState"],
    isFinal: row.isFinal,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapCrmPipelineTransitionRuleRecord(
  row: typeof crmPipelineTransitionRules.$inferSelect
): CrmPipelineTransitionRule {
  return {
    id: row.id,
    tenantId: row.tenantId,
    pipelineId: row.pipelineId,
    fromStageId: row.fromStageId,
    toStageId: row.toStageId,
    requiredPermission: row.requiredPermission,
    requiredFields: row.requiredFields,
    requireReason: row.requireReason,
    requireFeasibilityOk: row.requireFeasibilityOk,
    minProbability: row.minProbability,
    guardNote: row.guardNote,
    status: row.status as CrmPipelineTransitionRule["status"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapCrmPipelineStageAutomationDefinitionRecord(
  row: typeof crmPipelineStageAutomationDefinitions.$inferSelect
): CrmPipelineStageAutomationDefinition {
  return {
    id: row.id,
    tenantId: row.tenantId,
    pipelineId: row.pipelineId,
    stageId: row.stageId,
    trigger: row.trigger as CrmPipelineStageAutomationDefinition["trigger"],
    actionType: row.actionType,
    actionConfig: row.actionConfig,
    status: row.status as CrmPipelineStageAutomationDefinition["status"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
