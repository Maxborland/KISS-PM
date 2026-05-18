import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  createAccessRole,
  createPosition,
  createUser,
  deleteAccessRole,
  deletePosition,
  deleteUser,
  fetchAccessRoles,
  fetchApiHealth,
  fetchAuditEvents,
  fetchMe,
  fetchPositions,
  fetchUsers,
  login,
  logout,
  updateAccessRole,
  updatePosition,
  updateProfile,
  updateTheme,
  updateUser
} from "./api";

export const workspaceQueryKeys = {
  health: () => ["health"] as const,
  me: () => ["session", "me"] as const,
  users: () => ["workspace", "users"] as const,
  positions: () => ["workspace", "positions"] as const,
  accessRoles: () => ["workspace", "accessRoles"] as const,
  auditEvents: () => ["workspace", "auditEvents"] as const
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
