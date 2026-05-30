"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { ApiError } from "@/lib/api";
import { loginWithPassword, type AuthLoginInput } from "@/lib/api/auth";
import { queryKeys } from "@/lib/api/query-keys";
import { LoginScreenView } from "@/views/screens/login-screen-view";

type RuntimeLoginScreenProps = {
  mode: "login-route" | "protected-route";
  onAuthenticated?: () => void | Promise<void>;
};

export function RuntimeLoginScreen({ mode, onAuthenticated }: RuntimeLoginScreenProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: (input: AuthLoginInput) => loginWithPassword(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspace.root });
      if (mode === "login-route") {
        router.replace("/dashboard");
        return;
      }
      await onAuthenticated?.();
    }
  });

  return (
    <LoginScreenView
      defaultEmail="admin@kiss-pm.local"
      submitting={mutation.isPending}
      error={loginErrorCode(mutation.error)}
      onSubmit={(input) => mutation.mutate(input)}
    />
  );
}

function loginErrorCode(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError && typeof error.body.error === "string") {
    return error.body.error;
  }
  return "unknown";
}
