import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  createAccessRole,
  createClient,
  createCustomField,
  createContact,
  createDealStage,
  createCrmComment,
  createCrmFile,
  createCrmTask,
  createOpportunity,
  createProduct,
  createProjectTask,
  createPosition,
  createProjectType,
  createProjectTemplate,
  createUser,
  activateOpportunityProject,
  checkOpportunityFeasibility,
  deleteAccessRole,
  deletePosition,
  deleteUser,
  fetchAccessRoles,
  fetchApiHealth,
  fetchAuditEvents,
  fetchClients,
  fetchContacts,
  fetchCustomFields,
  fetchDealStages,
  fetchMe,
  fetchMyWork,
  fetchOpportunity,
  fetchCrmActivity,
  fetchOpportunities,
  fetchPositions,
  fetchProducts,
  fetchProjects,
  fetchProjectTypes,
  fetchProjectTemplates,
  fetchProjectDetail,
  fetchProjectTasks,
  fetchUsers,
  finalizeOpportunity,
  login,
  logout,
  updateAccessRole,
  updateClient,
  updateCustomField,
  updateContact,
  updateDealStage,
  updateOpportunity,
  updateCrmTask,
  updateOpportunityStage,
  updatePosition,
  updateProduct,
  updateProjectTaskStatus,
  updateProjectType,
  updateProfile,
  updateProjectTemplate,
  updateTheme,
  updateUser
} from "./api";
import type { CrmActivityEntityType } from "./api";

export const workspaceQueryKeys = {
  health: () => ["health"] as const,
  me: () => ["session", "me"] as const,
  users: () => ["workspace", "users"] as const,
  positions: () => ["workspace", "positions"] as const,
  accessRoles: () => ["workspace", "accessRoles"] as const,
  auditEvents: () => ["workspace", "auditEvents"] as const,
  clients: () => ["workspace", "crm", "clients"] as const,
  contacts: () => ["workspace", "crm", "contacts"] as const,
  products: () => ["workspace", "crm", "products"] as const,
  projectTypes: () => ["workspace", "crm", "projectTypes"] as const,
  dealStages: () => ["workspace", "crm", "dealStages"] as const,
  opportunities: () => ["workspace", "opportunities"] as const,
  opportunity: (opportunityId: string) =>
    ["workspace", "opportunities", opportunityId] as const,
  crmActivity: (entityType: CrmActivityEntityType, entityId: string) =>
    ["workspace", "crm", entityType, entityId, "activity"] as const,
  projects: () => ["workspace", "projects"] as const,
  projectDetail: (projectId: string) => ["workspace", "projects", projectId] as const,
  projectTasks: (projectId: string) =>
    ["workspace", "projects", projectId, "tasks"] as const,
  myWork: () => ["workspace", "myWork"] as const,
  customFields: () => ["workspace", "config", "customFields"] as const,
  projectTemplates: () => ["workspace", "config", "projectTemplates"] as const
};

export async function clearSessionQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: ["session"] }),
    queryClient.cancelQueries({ queryKey: ["workspace"] })
  ]);
  await Promise.all([
    queryClient.resetQueries({ queryKey: ["session"] }),
    queryClient.resetQueries({ queryKey: ["workspace"] })
  ]);
  queryClient.removeQueries({ queryKey: ["session"], type: "inactive" });
  queryClient.removeQueries({ queryKey: ["workspace"], type: "inactive" });
}

export function useHealthQuery() {
  return useQuery({
    queryKey: workspaceQueryKeys.health(),
    queryFn: fetchApiHealth
  });
}

export function useMeQuery() {
  return useQuery({
    queryKey: workspaceQueryKeys.me(),
    queryFn: fetchMe,
    retry: false
  });
}

export function useUsersQuery(enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.users(),
    queryFn: fetchUsers,
    enabled
  });
}

export function usePositionsQuery(enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.positions(),
    queryFn: fetchPositions,
    enabled
  });
}

export function useAccessRolesQuery(enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.accessRoles(),
    queryFn: fetchAccessRoles,
    enabled
  });
}

export function useAuditEventsQuery(enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.auditEvents(),
    queryFn: fetchAuditEvents,
    enabled
  });
}

export function useClientsQuery(enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.clients(),
    queryFn: fetchClients,
    enabled
  });
}

export function useContactsQuery(enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.contacts(),
    queryFn: fetchContacts,
    enabled
  });
}

export function useProductsQuery(enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.products(),
    queryFn: fetchProducts,
    enabled
  });
}

export function useProjectTypesQuery(enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.projectTypes(),
    queryFn: fetchProjectTypes,
    enabled
  });
}

export function useDealStagesQuery(enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.dealStages(),
    queryFn: fetchDealStages,
    enabled
  });
}

export function useOpportunitiesQuery(enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.opportunities(),
    queryFn: fetchOpportunities,
    enabled
  });
}

export function useOpportunityQuery(opportunityId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.opportunity(opportunityId ?? "unknown"),
    queryFn: () => fetchOpportunity(opportunityId ?? ""),
    enabled: enabled && Boolean(opportunityId)
  });
}

export function useCrmActivityQuery(
  entityType: CrmActivityEntityType,
  entityId: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: workspaceQueryKeys.crmActivity(entityType, entityId ?? "unknown"),
    queryFn: () => fetchCrmActivity(entityType, entityId ?? ""),
    enabled: enabled && Boolean(entityId)
  });
}

export function useProjectsQuery(enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.projects(),
    queryFn: fetchProjects,
    enabled
  });
}

export function useProjectDetailQuery(projectId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.projectDetail(projectId ?? "unknown"),
    queryFn: () => fetchProjectDetail(projectId ?? ""),
    enabled: enabled && Boolean(projectId)
  });
}

export function useProjectTasksQuery(projectId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.projectTasks(projectId ?? "unknown"),
    queryFn: () => fetchProjectTasks(projectId ?? ""),
    enabled: enabled && Boolean(projectId)
  });
}

export function useMyWorkQuery(enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.myWork(),
    queryFn: fetchMyWork,
    enabled
  });
}

export function useCustomFieldsQuery(enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.customFields(),
    queryFn: fetchCustomFields,
    enabled
  });
}

export function useProjectTemplatesQuery(enabled: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.projectTemplates(),
    queryFn: fetchProjectTemplates,
    enabled
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: async (me) => {
      await clearSessionQueries(queryClient);
      queryClient.setQueryData(workspaceQueryKeys.me(), me);
    }
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSettled: async () => {
      await clearSessionQueries(queryClient);
    }
  });
}

export function useUserMutations() {
  const queryClient = useQueryClient();
  const invalidateUsers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.users() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.me() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.auditEvents() })
    ]);
  };

  return {
    createUser: useMutation({ mutationFn: createUser, onSuccess: invalidateUsers }),
    updateUser: useMutation({
      mutationFn: ({ userId, input }: Parameters<typeof updateUser> extends [infer Id, infer Input] ? { userId: Id; input: Input } : never) =>
        updateUser(userId, input),
      onSuccess: invalidateUsers
    }),
    deleteUser: useMutation({ mutationFn: deleteUser, onSuccess: invalidateUsers })
  };
}

export function usePositionMutations() {
  const queryClient = useQueryClient();
  const invalidatePositions = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.positions() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.users() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.me() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.auditEvents() })
    ]);
  };

  return {
    createPosition: useMutation({
      mutationFn: createPosition,
      onSuccess: invalidatePositions
    }),
    updatePosition: useMutation({
      mutationFn: ({ positionId, input }: Parameters<typeof updatePosition> extends [infer Id, infer Input] ? { positionId: Id; input: Input } : never) =>
        updatePosition(positionId, input),
      onSuccess: invalidatePositions
    }),
    deletePosition: useMutation({
      mutationFn: deletePosition,
      onSuccess: invalidatePositions
    })
  };
}

export function useAccessRoleMutations() {
  const queryClient = useQueryClient();
  const invalidateAccessRoles = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.accessRoles() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.users() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.me() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.auditEvents() })
    ]);
  };

  return {
    createAccessRole: useMutation({
      mutationFn: createAccessRole,
      onSuccess: invalidateAccessRoles
    }),
    updateAccessRole: useMutation({
      mutationFn: ({ roleId, input }: Parameters<typeof updateAccessRole> extends [infer Id, infer Input] ? { roleId: Id; input: Input } : never) =>
        updateAccessRole(roleId, input),
      onSuccess: invalidateAccessRoles
    }),
    deleteAccessRole: useMutation({
      mutationFn: deleteAccessRole,
      onSuccess: invalidateAccessRoles
    })
  };
}

export function useWorkspaceConfigMutations() {
  const queryClient = useQueryClient();
  const invalidateWorkspaceConfig = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.customFields() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.projectTemplates() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.auditEvents() })
    ]);
  };

  return {
    createCustomField: useMutation({
      mutationFn: createCustomField,
      onSuccess: invalidateWorkspaceConfig
    }),
    updateCustomField: useMutation({
      mutationFn: ({ fieldId, input }: Parameters<typeof updateCustomField> extends [infer Id, infer Input] ? { fieldId: Id; input: Input } : never) =>
        updateCustomField(fieldId, input),
      onSuccess: invalidateWorkspaceConfig
    }),
    createProjectTemplate: useMutation({
      mutationFn: createProjectTemplate,
      onSuccess: invalidateWorkspaceConfig
    }),
    updateProjectTemplate: useMutation({
      mutationFn: ({ templateId, input }: Parameters<typeof updateProjectTemplate> extends [infer Id, infer Input] ? { templateId: Id; input: Input } : never) =>
        updateProjectTemplate(templateId, input),
      onSuccess: invalidateWorkspaceConfig
    })
  };
}

export function useCrmMutations() {
  const queryClient = useQueryClient();
  const invalidateCrm = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.clients() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.contacts() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.products() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.projectTypes() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.dealStages() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.opportunities() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.auditEvents() })
    ]);
  };

  return {
    createClient: useMutation({
      mutationFn: createClient,
      onSuccess: invalidateCrm
    }),
    updateClient: useMutation({
      mutationFn: ({ clientId, input }: Parameters<typeof updateClient> extends [infer Id, infer Input] ? { clientId: Id; input: Input } : never) =>
        updateClient(clientId, input),
      onSuccess: invalidateCrm
    }),
    createContact: useMutation({
      mutationFn: createContact,
      onSuccess: invalidateCrm
    }),
    updateContact: useMutation({
      mutationFn: ({ contactId, input }: Parameters<typeof updateContact> extends [infer Id, infer Input] ? { contactId: Id; input: Input } : never) =>
        updateContact(contactId, input),
      onSuccess: invalidateCrm
    }),
    createProduct: useMutation({
      mutationFn: createProduct,
      onSuccess: invalidateCrm
    }),
    updateProduct: useMutation({
      mutationFn: ({ productId, input }: Parameters<typeof updateProduct> extends [infer Id, infer Input] ? { productId: Id; input: Input } : never) =>
        updateProduct(productId, input),
      onSuccess: invalidateCrm
    }),
    createProjectType: useMutation({
      mutationFn: createProjectType,
      onSuccess: invalidateCrm
    }),
    updateProjectType: useMutation({
      mutationFn: ({ projectTypeId, input }: Parameters<typeof updateProjectType> extends [infer Id, infer Input] ? { projectTypeId: Id; input: Input } : never) =>
        updateProjectType(projectTypeId, input),
      onSuccess: invalidateCrm
    }),
    createDealStage: useMutation({
      mutationFn: createDealStage,
      onSuccess: invalidateCrm
    }),
    updateDealStage: useMutation({
      mutationFn: ({ stageId, input }: Parameters<typeof updateDealStage> extends [infer Id, infer Input] ? { stageId: Id; input: Input } : never) =>
        updateDealStage(stageId, input),
      onSuccess: invalidateCrm
    })
  };
}

export function useProjectIntakeMutations() {
  const queryClient = useQueryClient();
  const invalidateProjectIntake = (opportunityId?: string | null) =>
    invalidateProjectIntakeQueries(queryClient, opportunityId);

  return {
    createOpportunity: useMutation({
      mutationFn: createOpportunity,
      onSuccess: async () => {
        await invalidateProjectIntake();
      }
    }),
    updateOpportunity: useMutation({
      mutationFn: ({ opportunityId, input }: Parameters<typeof updateOpportunity> extends [infer Id, infer Input] ? { opportunityId: Id; input: Input } : never) =>
        updateOpportunity(opportunityId, input),
      onSuccess: async (_result, variables) => {
        await invalidateProjectIntake(String(variables.opportunityId));
      }
    }),
    checkFeasibility: useMutation({
      mutationFn: checkOpportunityFeasibility,
      onSuccess: async (_result, opportunityId) => {
        await invalidateProjectIntake(opportunityId);
      }
    }),
    updateStage: useMutation({
      mutationFn: ({ opportunityId, input }: Parameters<typeof updateOpportunityStage> extends [infer Id, infer Input] ? { opportunityId: Id; input: Input } : never) =>
        updateOpportunityStage(opportunityId, input),
      onSuccess: async (_result, variables) => {
        await invalidateProjectIntake(String(variables.opportunityId));
      }
    }),
    activateProject: useMutation({
      mutationFn: ({ opportunityId, input }: Parameters<typeof activateOpportunityProject> extends [infer Id, infer Input] ? { opportunityId: Id; input: Input } : never) =>
        activateOpportunityProject(opportunityId, input),
      onSuccess: async (_result, variables) => {
        await invalidateProjectIntake(String(variables.opportunityId));
      }
    }),
    finalizeOpportunity: useMutation({
      mutationFn: ({ opportunityId, input }: Parameters<typeof finalizeOpportunity> extends [infer Id, infer Input] ? { opportunityId: Id; input: Input } : never) =>
        finalizeOpportunity(opportunityId, input),
      onSuccess: async (_result, variables) => {
        await invalidateProjectIntake(String(variables.opportunityId));
      }
    })
  };
}

export async function invalidateProjectIntakeQueries(
  queryClient: QueryClient,
  opportunityId?: string | null
): Promise<void> {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.opportunities() }),
    queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.projects() }),
    queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.auditEvents() })
  ];

  if (opportunityId) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.opportunity(opportunityId)
      }),
      queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.crmActivity("opportunity", opportunityId)
      })
    );
  }

  await Promise.all(invalidations);
}

export function useCrmActivityMutations(
  entityType: CrmActivityEntityType,
  entityId: string | null
) {
  const queryClient = useQueryClient();
  const invalidateActivity = async () => {
    if (!entityId) return;
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.crmActivity(entityType, entityId)
      }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.auditEvents() })
    ]);
  };

  return {
    createComment: useMutation({
      mutationFn: (input: Parameters<typeof createCrmComment>[2]) => {
        if (!entityId) throw new Error("crm_entity_id_required");
        return createCrmComment(entityType, entityId, input);
      },
      onSuccess: invalidateActivity
    }),
    createTask: useMutation({
      mutationFn: (input: Parameters<typeof createCrmTask>[2]) => {
        if (!entityId) throw new Error("crm_entity_id_required");
        return createCrmTask(entityType, entityId, input);
      },
      onSuccess: invalidateActivity
    }),
    createFile: useMutation({
      mutationFn: (input: Parameters<typeof createCrmFile>[2]) => {
        if (!entityId) throw new Error("crm_entity_id_required");
        return createCrmFile(entityType, entityId, input);
      },
      onSuccess: invalidateActivity
    }),
    updateTask: useMutation({
      mutationFn: (input: {
        activityId: string;
        status: Parameters<typeof updateCrmTask>[3]["status"];
      }) => {
        if (!entityId) throw new Error("crm_entity_id_required");
        return updateCrmTask(entityType, entityId, input.activityId, {
          status: input.status
        });
      },
      onSuccess: invalidateActivity
    })
  };
}

export function useProjectWorkMutations() {
  const queryClient = useQueryClient();
  const invalidateProjectWork = async (projectId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.projects() }),
      queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.projectDetail(projectId)
      }),
      queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.projectTasks(projectId)
      }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.myWork() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.auditEvents() })
    ]);
  };

  return {
    createTask: useMutation({
      mutationFn: ({ projectId, input }: Parameters<typeof createProjectTask> extends [infer ProjectId, infer Input] ? { projectId: ProjectId; input: Input } : never) =>
        createProjectTask(projectId, input),
      onSuccess: async (_result, variables) => {
        await invalidateProjectWork(String(variables.projectId));
      }
    }),
    updateTaskStatus: useMutation({
      mutationFn: ({ projectId, taskId, input }: Parameters<typeof updateProjectTaskStatus> extends [infer ProjectId, infer TaskId, infer Input] ? { projectId: ProjectId; taskId: TaskId; input: Input } : never) =>
        updateProjectTaskStatus(projectId, taskId, input),
      onSuccess: async (_result, variables) => {
        await invalidateProjectWork(String(variables.projectId));
      }
    })
  };
}

export function useProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.me() }),
        queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.users() }),
        queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.auditEvents() })
      ]);
    }
  });
}

export function useThemeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTheme,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.me() }),
        queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.users() }),
        queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.auditEvents() })
      ]);
    }
  });
}
