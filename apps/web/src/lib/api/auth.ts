"use client";

import { apiFetch } from "@/lib/api";
import type { WorkspaceUser } from "@/lib/api-types";

export type AuthLoginInput = {
  email: string;
  password: string;
};

export type AuthLoginResponse = {
  user: WorkspaceUser;
  workspace: {
    id: string;
  };
};

export function loginWithPassword(input: AuthLoginInput): Promise<AuthLoginResponse> {
  return apiFetch<AuthLoginResponse>("/api/auth/login", {
    method: "POST",
    json: input
  });
}
