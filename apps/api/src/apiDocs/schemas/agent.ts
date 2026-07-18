import {
  dateTimeSchema,
  openApiSchemaFragment,
  schemaRef,
  stringIdSchema
} from "./schemaPrimitives";

const agentToolKindSchema = { type: "string", enum: ["analyze", "mutation"] };

const agentStopReasonSchema = {
  type: "string",
  enum: ["completed", "max_iterations", "token_budget", "deadline"]
};

const agentActionOutcomeStatusSchema = {
  type: "string",
  enum: ["applied", "denied", "conflict", "failed"],
  description:
    "Per-item outcome: applied (governed command succeeded), denied (RBAC/capability refused, still audited), conflict (optimistic-lock/lifecycle conflict), failed (validation or downstream error)."
};

export const agentSchemas = openApiSchemaFragment({
  AgentToolKind: agentToolKindSchema,
  AgentStopReason: agentStopReasonSchema,
  AgentActionOutcomeStatus: agentActionOutcomeStatusSchema,
  AgentProviderStatus: {
    type: "object",
    required: ["model", "live", "configured"],
    properties: {
      model: { type: "string", minLength: 1 },
      live: {
        type: "boolean",
        description:
          "False for mock/demo/scripted providers: the channel works but no live LLM answers; UI must show the degradation."
      },
      configured: {
        type: "boolean",
        description: "False when no LLM provider is configured (propose returns 503)."
      }
    },
    additionalProperties: false
  },
  AgentToolAvailability: {
    type: "object",
    required: ["name", "title", "description", "kind", "allowed", "reason"],
    properties: {
      name: stringIdSchema,
      title: { type: "string", minLength: 1 },
      description: { type: "string" },
      kind: schemaRef("AgentToolKind"),
      allowed: { type: "boolean" },
      reason: {
        type: "string",
        description: "Capability decision code (for allowed tools an affirmative code, for denied tools the denial reason)."
      }
    },
    additionalProperties: false
  },
  AgentToolsResponse: {
    type: "object",
    required: ["tools", "provider"],
    properties: {
      tools: { type: "array", items: schemaRef("AgentToolAvailability") },
      provider: schemaRef("AgentProviderStatus")
    },
    additionalProperties: false
  },
  AgentThreadConversation: {
    type: "object",
    description:
      "Private per-user agent thread persisted on top of the collaboration model. Messages are read via GET /api/workspace/conversations/{conversationId}/messages; direct client writes are rejected with agent_conversation_readonly.",
    required: [
      "id",
      "tenantId",
      "entityType",
      "entityId",
      "conversationType",
      "title",
      "createdByUserId",
      "createdAt",
      "archivedAt"
    ],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      entityType: { type: "string", const: "agent" },
      entityId: {
        ...stringIdSchema,
        description: "Owner user id: one deterministic thread per user."
      },
      conversationType: { type: "string", const: "agent" },
      title: { type: "string", minLength: 1 },
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  AgentThreadResponse: {
    type: "object",
    required: ["conversation", "readState"],
    properties: {
      conversation: schemaRef("AgentThreadConversation"),
      readState: { oneOf: [schemaRef("ConversationReadState"), { type: "null" }] }
    },
    additionalProperties: false
  },
  AgentHistoryTurn: {
    type: "object",
    description:
      "Client-reconstructed history turn (fallback when threadId is not sent). role/author values assistant|henry map to the assistant role, anything else to user.",
    required: ["text"],
    properties: {
      role: { type: "string" },
      author: { type: "string" },
      text: { type: "string", minLength: 1, maxLength: 4000 }
    },
    additionalProperties: true
  },
  AgentProposeRequest: {
    type: "object",
    required: ["goal"],
    properties: {
      goal: { type: "string", minLength: 1, maxLength: 2000 },
      attachmentIds: {
        type: "array",
        items: stringIdSchema,
        maxItems: 50,
        description:
          "Workspace attachment ids resolved through the governed download route (RBAC re-checked); at most 5 text files / 50000 chars reach the LLM, omissions are marked honestly."
      },
      history: {
        type: "array",
        items: schemaRef("AgentHistoryTurn"),
        description: "Ignored when threadId is provided: the persistent thread is then the source of truth (last 12 turns)."
      },
      threadId: {
        ...stringIdSchema,
        description:
          "Optional persistent agent thread id from GET /api/workspace/agent/thread. A thread not owned by the caller is rejected with 403 agent_thread_forbidden (fail-closed)."
      }
    },
    additionalProperties: true
  },
  AgentActionPreview: {
    type: "object",
    description: "Payload-backed honest before/after preview shown on the review card before confirmation.",
    required: ["before", "after"],
    properties: {
      before: { type: "string" },
      after: { type: "string" }
    },
    additionalProperties: false
  },
  AgentActionPreconditionVersions: {
    type: "object",
    description:
      "Fail-closed optimistic-lock preconditions the client must echo to POST /api/workspace/agent/execute; the server never substitutes current versions.",
    properties: {
      taskUpdatedAt: {
        ...dateTimeSchema,
        description: "Required for change_task_status and update_task."
      },
      planVersion: {
        type: "integer",
        minimum: 1,
        description: "Required for plan-affecting apply_* actions; planning parsers reject versions below 1."
      }
    },
    additionalProperties: false
  },
  AgentCapabilityDecision: {
    type: "object",
    required: ["allowed", "reason"],
    properties: {
      allowed: { type: "boolean" },
      reason: { type: "string" }
    },
    additionalProperties: false
  },
  AgentProposedAction: {
    type: "object",
    required: ["tool", "title", "input", "capability", "preview", "preconditionVersions"],
    properties: {
      tool: stringIdSchema,
      title: { type: "string", minLength: 1 },
      input: schemaRef("AnyJsonObject"),
      capability: {
        ...schemaRef("AgentCapabilityDecision"),
        description:
          "Coarse RBAC pre-check; the exact check is repeated inside execute. allowed:false actions are shown but cannot be applied."
      },
      preview: schemaRef("AgentActionPreview"),
      preconditionVersions: schemaRef("AgentActionPreconditionVersions")
    },
    additionalProperties: false
  },
  AgentAnalyzeResult: {
    type: "object",
    required: ["tool", "input", "result"],
    properties: {
      tool: stringIdSchema,
      input: schemaRef("AnyJsonObject"),
      result: {}
    },
    additionalProperties: false
  },
  AgentProposeResponse: {
    type: "object",
    description:
      "Proposal only: no mutation happens here. threadId/messageIds/traceMessageId are present only when collaboration persistence is configured and the turns were really written.",
    required: [
      "goal",
      "model",
      "reasoning",
      "analyzeResults",
      "proposedActions",
      "iterations",
      "stopReason",
      "outputTokens"
    ],
    properties: {
      goal: { type: "string", minLength: 1, maxLength: 2000 },
      model: { type: "string", minLength: 1 },
      reasoning: { type: "string" },
      analyzeResults: { type: "array", items: schemaRef("AgentAnalyzeResult") },
      proposedActions: { type: "array", items: schemaRef("AgentProposedAction") },
      iterations: { type: "integer", minimum: 0 },
      stopReason: schemaRef("AgentStopReason"),
      outputTokens: { type: "integer", minimum: 0 },
      threadId: stringIdSchema,
      messageIds: { type: "array", items: stringIdSchema },
      traceMessageId: stringIdSchema
    },
    additionalProperties: false
  },
  AgentProposeStreamEvent: {
    description:
      "JSON payload of one SSE frame on POST /api/workspace/agent/propose/stream. The SSE `event:` field equals reasoning|analyze|proposal (mirrors the payload `type`), or done/error for the terminal frame. `done` carries the full AgentProposeResponse; `error` carries {\"error\": string}.",
    oneOf: [
      {
        type: "object",
        required: ["type", "text"],
        properties: {
          type: { type: "string", const: "reasoning" },
          text: { type: "string" }
        },
        additionalProperties: false
      },
      {
        type: "object",
        required: ["type", "tool", "title", "ok"],
        properties: {
          type: { type: "string", const: "analyze" },
          tool: stringIdSchema,
          title: { type: "string" },
          ok: { type: "boolean" }
        },
        additionalProperties: false
      },
      {
        type: "object",
        required: ["type", "tool", "title"],
        properties: {
          type: { type: "string", const: "proposal" },
          tool: stringIdSchema,
          title: { type: "string" }
        },
        additionalProperties: false
      },
      schemaRef("AgentProposeResponse"),
      schemaRef("ApiError")
    ]
  },
  AgentProviderNotConfiguredResponse: {
    type: "object",
    description:
      "503 body when no LLM provider is configured. The user turn and an error receipt are still persisted into the agent thread when collaboration persistence is available.",
    required: ["error", "provider"],
    properties: {
      error: { type: "string", const: "agent_provider_not_configured" },
      provider: schemaRef("AgentProviderStatus"),
      threadId: stringIdSchema,
      messageIds: { type: "array", items: stringIdSchema }
    },
    additionalProperties: false
  },
  AgentExecuteAction: {
    type: "object",
    required: ["tool", "input"],
    properties: {
      tool: {
        ...stringIdSchema,
        description: "Mutation tool name from the proposal; non-mutation or unknown tools fail the item with invalid_action."
      },
      input: schemaRef("AnyJsonObject"),
      preconditionVersions: schemaRef("AgentActionPreconditionVersions")
    },
    additionalProperties: false
  },
  AgentExecuteRequest: {
    type: "object",
    required: ["actions"],
    properties: {
      actions: {
        type: "array",
        items: schemaRef("AgentExecuteAction"),
        minItems: 1,
        maxItems: 20
      }
    },
    additionalProperties: true
  },
  AgentActionResult: {
    type: "object",
    description:
      "Per-action receipt. auditEventId references a really persisted agent provenance audit event (sourceWorkflow \"agent\"; present only when audit persistence is configured, for applied and denied items). planningAuditEventId/planVersion/projectId address the plan commit for applied plan-affecting actions.",
    required: ["tool", "ok", "status"],
    properties: {
      tool: stringIdSchema,
      ok: { type: "boolean" },
      status: schemaRef("AgentActionOutcomeStatus"),
      error: { type: "string", description: "Machine-readable failure/denial code (e.g. missing_precondition_versions, invalid_action_input, unsupported_update_field, task_participant_role_required)." },
      result: { description: "Governed-route response body for applied actions." },
      currentVersions: {
        ...schemaRef("AgentActionPreconditionVersions"),
        description: "Actual versions on a precondition conflict, so the client can rebase the review card."
      },
      auditEventId: stringIdSchema,
      planningAuditEventId: stringIdSchema,
      planVersion: { type: "integer", minimum: 0 },
      projectId: stringIdSchema
    },
    additionalProperties: false
  },
  AgentExecuteSummary: {
    type: "object",
    required: ["applied", "denied", "conflict", "failed"],
    properties: {
      applied: { type: "integer", minimum: 0 },
      denied: { type: "integer", minimum: 0 },
      conflict: { type: "integer", minimum: 0 },
      failed: { type: "integer", minimum: 0 }
    },
    additionalProperties: false
  },
  AgentExecuteResponse: {
    type: "object",
    description:
      "Always 200 with per-item outcomes; item-level denials/conflicts do not fail the batch. correlationId groups the batch's audit events and is present only when audit persistence recorded them. threadId/messageId reference the persisted result receipt in the agent thread.",
    required: ["results", "applied", "summary"],
    properties: {
      results: { type: "array", items: schemaRef("AgentActionResult") },
      applied: { type: "boolean", description: "True when at least one action was applied." },
      summary: schemaRef("AgentExecuteSummary"),
      correlationId: stringIdSchema,
      threadId: stringIdSchema,
      messageId: stringIdSchema
    },
    additionalProperties: false
  }
});
