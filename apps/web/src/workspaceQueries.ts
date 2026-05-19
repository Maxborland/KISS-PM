import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  createAccessRole,
  createClient,
  createCustomField,
  createContact,
  createDealStage,
  createOpportunity,
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
  fetchOpportunities,
  fetchPositions,
  fetchProjects,
  fetchProjectTypes,
  fetchProjectTemplates,
  fetchProjectDetail,
  fetchProjectTasks,
  fetchUsers,
  login,
  logout,
  updateAccessRole,
  updateClient,
  updateCustomField,
  updateContact,
  updateDealStage,
  updateOpportunityStage,
  updatePosition,
  updateProjectType,
  updateProfile,
  updateProjectTemplate,
  updateTheme,
  updateUser
} from "./api";

export const workspaceQueryKeys = {
  health: () => ["health"] as const,
  me: () => ["session", "me"] as const,
  users: () => ["workspace", "users"] as const,
  positions: () => ["workspace", "positions"] as const,
  accessRoles: () => ["workspace", "accessRoles"] as const,
  auditEvents: () => ["workspace", "auditEvents"] as const,
  clients: () => ["workspace", "crm", "clients"] as const,
  contacts: () => ["workspace", "crm", "contacts"] as const,
  projectTypes: () => ["workspace", "crm", "projectTypes"] as const,
  dealStages: () => ["workspace", "crm", "dealStages"] as const,
  opportunities: () => ["workspace", "opportunities"] as const,
  opportunity: (opportunityId: string) =>
    ["workspace", "opportunities", opportunityId] as const,
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
  const invalidateProjectIntake = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.opportunities() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.projects() }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.auditEvents() })
    ]);
  };

  return {
    createOpportunity: useMutation({
      mutationFn: createOpportunity,
      onSuccess: invalidateProjectIntake
    }),
    checkFeasibility: useMutation({
      mutationFn: checkOpportunityFeasibility,
      onSuccess: async (_result, opportunityId) => {
        await Promise.all([
          invalidateProjectIntake(),
          queryClient.invalidateQueries({
            queryKey: workspaceQueryKeys.opportunity(opportunityId)
          })
        ]);
      }
    }),
    updateStage: useMutation({
      mutationFn: ({ opportunityId, input }: Parameters<typeof updateOpportunityStage> extends [infer Id, infer Input] ? { opportunityId: Id; input: Input } : never) =>
        updateOpportunityStage(opportunityId, input),
      onSuccess: async (_result, variables) => {
        await Promise.all([
          invalidateProjectIntake(),
          queryClient.invalidateQueries({
            queryKey: workspaceQueryKeys.opportunity(String(variables.opportunityId))
          })
        ]);
      }
    }),
    activateProject: useMutation({
      mutationFn: ({ opportunityId, input }: Parameters<typeof activateOpportunityProject> extends [infer Id, infer Input] ? { opportunityId: Id; input: Input } : never) =>
        activateOpportunityProject(opportunityId, input),
      onSuccess: async (_result, variables) => {
        await Promise.all([
          invalidateProjectIntake(),
          queryClient.invalidateQueries({
            queryKey: workspaceQueryKeys.opportunity(String(variables.opportunityId))
          })
        ]);
      }
    })
  };
}

export function useProjectWorkMutations() {
  const queryClient = useQueryClient();

  return {
    createTask: useMutation({
      mutationFn: ({ projectId, input }: Parameters<typeof createProjectTask> extends [infer ProjectId, infer Input] ? { projectId: ProjectId; input: Input } : never) =>
        createProjectTask(projectId, input),
      onSuccess: async (_result, variables) => {
        const projectId = String(variables.projectId);
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
