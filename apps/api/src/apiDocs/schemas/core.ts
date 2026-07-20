import {
  nullableStringSchema,
  openApiSchemaFragment,
  schemaRef,
  stringIdSchema
} from "./schemaPrimitives";

export const coreSchemas = openApiSchemaFragment({
  ApiError: {
    type: "object",
    required: ["error"],
    properties: {
      error: {
        type: "string",
        description: "Stable machine-readable error code."
      }
    },
    additionalProperties: true
  },
  AnyJsonObject: {
    type: "object",
    additionalProperties: true,
    description:
      "Module-specific schema is documented in docs/api and will be promoted here as each route receives strict OpenAPI coverage."
  },
  OkResponse: {
    type: "object",
    required: ["status"],
    properties: {
      status: { type: "string", const: "ok" }
    },
    additionalProperties: false
  },
  ProfileDeactivationRequestResponse: {
    type: "object",
    required: ["status", "requestedAt"],
    properties: {
      status: { type: "string", const: "recorded" },
      requestedAt: { type: "string", format: "date-time" }
    },
    additionalProperties: false
  },
  TenantUser: {
    type: "object",
    required: ["id", "tenantId", "name", "accessProfileId"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      accessProfileId: stringIdSchema
    },
    additionalProperties: false
  },
  WorkspaceUser: {
    allOf: [
      schemaRef("TenantUser"),
      {
        type: "object",
        required: [
          "email",
          "positionId",
          "positionName",
          "phone",
          "telegram",
          "status",
          "theme",
          "accentColor"
        ],
        properties: {
          email: { type: "string", format: "email", maxLength: 254 },
          positionId: nullableStringSchema,
          positionName: nullableStringSchema,
          phone: nullableStringSchema,
          telegram: nullableStringSchema,
          status: { type: "string", enum: ["active", "inactive"] },
          workspaceName: { type: "string", minLength: 1, maxLength: 160 },
          accessProfileName: { type: "string", minLength: 1, maxLength: 160 },
          theme: { type: "string", enum: ["light", "dark", "system"] },
          accentColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }
        },
        additionalProperties: false
      }
    ]
  },
  Position: {
    type: "object",
    required: ["id", "tenantId", "name", "description"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      description: nullableStringSchema
    },
    additionalProperties: false
  },
  AccessProfile: {
    type: "object",
    required: ["id", "tenantId", "name", "permissions"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      permissions: {
        type: "array",
        items: { type: "string", minLength: 1 },
        uniqueItems: true
      }
    },
    additionalProperties: false
  },
  LoginRequest: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email", minLength: 3, maxLength: 254 },
      password: { type: "string", minLength: 1, maxLength: 1024 }
    },
    additionalProperties: false
  },
  RegisterRequest: {
    type: "object",
    required: ["email", "password", "name"],
    properties: {
      email: { type: "string", format: "email", minLength: 3, maxLength: 254 },
      password: { type: "string", minLength: 8, maxLength: 1024 },
      name: { type: "string", minLength: 1, maxLength: 160 },
      workspaceName: { type: "string", minLength: 1, maxLength: 160 }
    },
    additionalProperties: false
  },
  PasswordResetRequest: {
    type: "object",
    required: ["email"],
    properties: {
      email: { type: "string", format: "email", minLength: 3, maxLength: 254 }
    },
    additionalProperties: false
  },
  PasswordResetConfirmRequest: {
    type: "object",
    required: ["token", "password"],
    properties: {
      token: { type: "string", minLength: 1, maxLength: 256 },
      password: { type: "string", minLength: 8, maxLength: 1024 }
    },
    additionalProperties: false
  },
  AuthSessionResponse: {
    type: "object",
    required: ["user", "workspace"],
    properties: {
      user: schemaRef("TenantUser"),
      workspace: schemaRef("WorkspaceIdentity")
    },
    additionalProperties: false
  },
  AuthMeResponse: {
    type: "object",
    required: ["user", "permissions", "workspace"],
    properties: {
      user: {
        oneOf: [schemaRef("TenantUser"), schemaRef("WorkspaceUser")]
      },
      permissions: {
        type: "array",
        items: { type: "string", minLength: 1 },
        uniqueItems: true
      },
      workspace: schemaRef("WorkspaceIdentity")
    },
    additionalProperties: false
  },
  WorkspaceIdentity: {
    type: "object",
    required: ["id"],
    properties: {
      id: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 }
    },
    additionalProperties: false
  },
  DevUsersResponse: {
    type: "object",
    required: ["users"],
    properties: {
      users: { type: "array", items: schemaRef("TenantUser") }
    },
    additionalProperties: false
  },
  CurrentTenantResponse: {
    type: "object",
    required: ["tenant", "user"],
    properties: {
      tenant: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: stringIdSchema,
          name: { type: "string", minLength: 1 }
        },
        additionalProperties: false
      },
      user: schemaRef("TenantUser")
    },
    additionalProperties: false
  },
  TenantUsersResponse: {
    type: "object",
    required: ["users"],
    properties: {
      users: { type: "array", items: schemaRef("TenantUser") }
    },
    additionalProperties: false
  },
  AccessProfileWriteRequest: {
    type: "object",
    required: ["id", "name", "permissions"],
    properties: {
      id: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      permissions: {
        type: "array",
        items: { type: "string", minLength: 1 },
        uniqueItems: true
      }
    },
    additionalProperties: false
  },
  AccessProfilesResponse: {
    type: "object",
    required: ["accessProfiles"],
    properties: {
      accessProfiles: { type: "array", items: schemaRef("AccessProfile") }
    },
    additionalProperties: false
  },
  AccessProfileResponse: {
    type: "object",
    required: ["accessProfile"],
    properties: {
      accessProfile: schemaRef("AccessProfile")
    },
    additionalProperties: false
  },
  WorkspaceUsersResponse: {
    type: "object",
    required: ["privateFieldsIncluded", "users"],
    properties: {
      privateFieldsIncluded: { type: "boolean" },
      users: { type: "array", items: schemaRef("WorkspaceUser") }
    },
    additionalProperties: false
  },
  WorkspaceUserResponse: {
    type: "object",
    required: ["user"],
    properties: {
      user: schemaRef("WorkspaceUser")
    },
    additionalProperties: false
  },
  WorkspaceInvitationRequest: {
    type: "object",
    required: ["email", "name", "accessProfileId"],
    properties: {
      id: stringIdSchema,
      email: { type: "string", format: "email", maxLength: 254 },
      name: { type: "string", minLength: 1, maxLength: 160 },
      accessProfileId: stringIdSchema,
      positionId: nullableStringSchema,
      phone: nullableStringSchema,
      telegram: nullableStringSchema
    },
    additionalProperties: false
  },
  WorkspaceInvitationResponse: {
    type: "object",
    required: ["user", "delivery"],
    properties: {
      user: schemaRef("WorkspaceUser"),
      // "email" — письмо ушло каналом инсталляции; "none" — канал не настроен,
      // и тогда сырой токен возвращается ровно один раз (иначе живёт лишь как хэш).
      delivery: { type: "string", enum: ["email", "none"] },
      // true, когда канал был настроен, но отправка письма упала после коммита
      // транзакции — токен тогда всё равно возвращается для ручной передачи.
      deliveryFailed: { type: "boolean" },
      invitationToken: { type: "string", minLength: 64, maxLength: 64, pattern: "^[0-9a-f]{64}$" },
      expiresAt: { type: "string", format: "date-time" }
    },
    additionalProperties: false
  },
  WorkspaceInvitationAcceptRequest: {
    type: "object",
    required: ["token", "password"],
    properties: {
      token: { type: "string", minLength: 64, maxLength: 64, pattern: "^[0-9a-f]{64}$" },
      password: { type: "string", minLength: 8, maxLength: 1024 }
    },
    additionalProperties: false
  },
  WorkspaceUserResetTokenResponse: {
    type: "object",
    required: ["resetToken", "expiresAt"],
    properties: {
      // Raw reset token (hex, 32 bytes). Returned exactly once; only the hash is stored.
      resetToken: { type: "string", minLength: 64, maxLength: 64, pattern: "^[0-9a-f]{64}$" },
      expiresAt: { type: "string", format: "date-time" }
    },
    additionalProperties: false
  },
  WorkspaceUserCreateRequest: {
    type: "object",
    required: ["email", "name", "accessProfileId", "password"],
    properties: {
      id: stringIdSchema,
      email: { type: "string", format: "email", maxLength: 254 },
      name: { type: "string", minLength: 1, maxLength: 160 },
      accessProfileId: stringIdSchema,
      positionId: nullableStringSchema,
      phone: nullableStringSchema,
      telegram: nullableStringSchema,
      status: { type: "string", enum: ["active", "inactive"], default: "active" },
      theme: { type: "string", enum: ["light", "dark", "system"], default: "light" },
      accentColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$", default: "#0f766e" },
      password: { type: "string", minLength: 8, maxLength: 1024 }
    },
    additionalProperties: false
  },
  WorkspaceUserPatchRequest: {
    type: "object",
    properties: {
      email: { type: "string", format: "email", maxLength: 254 },
      name: { type: "string", minLength: 1, maxLength: 160 },
      accessProfileId: stringIdSchema,
      positionId: nullableStringSchema,
      phone: nullableStringSchema,
      telegram: nullableStringSchema,
      status: { type: "string", enum: ["active", "inactive"] },
      theme: { type: "string", enum: ["light", "dark", "system"] },
      accentColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }
    },
    additionalProperties: false
  },
  ProfilePatchRequest: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      phone: nullableStringSchema,
      telegram: nullableStringSchema
    },
    additionalProperties: false
  },
  ProfileThemePatchRequest: {
    type: "object",
    properties: {
      theme: { type: "string", enum: ["light", "dark", "system"] },
      accentColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }
    },
    additionalProperties: false
  },
  PositionWriteRequest: {
    type: "object",
    required: ["name"],
    properties: {
      id: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      description: nullableStringSchema
    },
    additionalProperties: false
  },
  PositionsResponse: {
    type: "object",
    required: ["positions"],
    properties: {
      positions: { type: "array", items: schemaRef("Position") }
    },
    additionalProperties: false
  },
  PositionResponse: {
    type: "object",
    required: ["position"],
    properties: {
      position: schemaRef("Position")
    },
    additionalProperties: false
  }
});
