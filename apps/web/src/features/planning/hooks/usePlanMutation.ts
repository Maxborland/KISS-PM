"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import { PlanningApiError } from "@kiss-pm/planning-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { planningApi } from "../planningApi";
import {
  initialPlanMutationStore,
  type ApplyBarState,
  type PendingPreview,
  type PlanMutationStore
} from "./planMutationState";
import { planKeys } from "./planKeys";
import { useCompensatingUndo } from "./useCompensatingUndo";

export function usePlanMutation(projectId: string) {
  const queryClient = useQueryClient();
  const [store, setStore] = useState<PlanMutationStore>(initialPlanMutationStore);
  const compensatingUndo = useCompensatingUndo();

  const setApplyBarState = useCallback((applyBarState: ApplyBarState, errorMessage: string | null = null) => {
    setStore((current) => ({ ...current, applyBarState, errorMessage }));
  }, []);

  const resetPending = useCallback(() => {
    setStore(initialPlanMutationStore);
  }, []);

  const handleConflict = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: planKeys.project(projectId) });
    setStore({
      ...initialPlanMutationStore,
      applyBarState: "conflict",
      errorMessage: "План обновлён другим пользователем. Данные перезагружены."
    });
  }, [projectId, queryClient]);

  const previewMutation = useMutation({
    mutationFn: async (command: PlanningCommand) => {
      const snapshot = queryClient.getQueryData<Awaited<ReturnType<typeof planningApi.getPlanReadModel>>>(
        planKeys.project(projectId)
      );
      if (!snapshot) throw new Error("plan_not_loaded");
      return planningApi.previewCommand(projectId, {
        command,
        clientPlanVersion: snapshot.planVersion
      });
    },
    onMutate: async () => {
      setApplyBarState("preview-pending");
    },
    onSuccess: (preview, command) => {
      const entry: PendingPreview = {
        command,
        preview,
        overlayReadModel: preview.after
      };
      setStore((current) => ({
        ...current,
        applyBarState: "preview-ready",
        pendingPreview: entry,
        undoStack: [...current.undoStack, entry],
        redoStack: [],
        errorMessage: null
      }));
    },
    onError: (error) => {
      if (error instanceof PlanningApiError && error.code === "plan_version_conflict") {
        void handleConflict();
        return;
      }
      setApplyBarState(
        "error",
        error instanceof Error ? error.message : "Не удалось рассчитать превью"
      );
    }
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const pending = store.pendingPreview;
      const snapshot = queryClient.getQueryData<Awaited<ReturnType<typeof planningApi.getPlanReadModel>>>(
        planKeys.project(projectId)
      );
      if (!pending || !snapshot) throw new Error("nothing_to_apply");
      return planningApi.applyCommand(projectId, {
        command: pending.command,
        clientPlanVersion: snapshot.planVersion,
        idempotencyKey: crypto.randomUUID()
      });
    },
    onMutate: () => setApplyBarState("applying"),
    onSuccess: (result) => {
      setStore((current) => {
        if (current.pendingPreview) {
          compensatingUndo.pushApplied({
            command: current.pendingPreview.command,
            before: current.pendingPreview.preview.before as Awaited<
              ReturnType<typeof planningApi.getPlanReadModel>
            >
          });
        }
        return { ...initialPlanMutationStore, applyBarState: "applied" };
      });
      queryClient.setQueryData(planKeys.project(projectId), result.readModel);
      window.setTimeout(() => setApplyBarState("idle"), 3000);
    },
    onError: async (error) => {
      if (error instanceof PlanningApiError && error.code === "plan_version_conflict") {
        await handleConflict();
        return;
      }
      setApplyBarState(
        "error",
        error instanceof Error ? error.message : "Не удалось применить изменения"
      );
    }
  });

  const applyBatchMutation = useMutation({
    mutationFn: async (commands: PlanningCommand[]) => {
      const snapshot = queryClient.getQueryData<Awaited<ReturnType<typeof planningApi.getPlanReadModel>>>(
        planKeys.project(projectId)
      );
      if (!snapshot) throw new Error("plan_not_loaded");
      return planningApi.applyCommandBatch(projectId, {
        commands,
        clientPlanVersion: snapshot.planVersion,
        idempotencyKey: crypto.randomUUID()
      });
    },
    onMutate: () => setApplyBarState("applying"),
    onSuccess: (result, commands) => {
      const snapshot = queryClient.getQueryData<Awaited<ReturnType<typeof planningApi.getPlanReadModel>>>(
        planKeys.project(projectId)
      );
      if (snapshot && commands.length === 1) {
        compensatingUndo.pushApplied({
          command: commands[0]!,
          before: snapshot as Awaited<ReturnType<typeof planningApi.getPlanReadModel>>
        });
      }
      queryClient.setQueryData(planKeys.project(projectId), result.readModel);
      resetPending();
      setApplyBarState("applied");
      window.setTimeout(() => setApplyBarState("idle"), 3000);
    },
    onError: async (error) => {
      if (error instanceof PlanningApiError && error.code === "plan_version_conflict") {
        await handleConflict();
        return;
      }
      setApplyBarState(
        "error",
        error instanceof Error ? error.message : "Не удалось применить пакет изменений"
      );
    }
  });

  const undoPending = useCallback(() => {
    setStore((current) => {
      if (current.undoStack.length <= 1) {
        return initialPlanMutationStore;
      }
      const nextStack = current.undoStack.slice(0, -1);
      const previous = nextStack[nextStack.length - 1];
      if (!previous) return initialPlanMutationStore;
      return {
        ...current,
        undoStack: nextStack,
        redoStack: current.pendingPreview ? [current.pendingPreview, ...current.redoStack] : current.redoStack,
        pendingPreview: previous,
        applyBarState: "preview-ready"
      };
    });
  }, []);

  const displayReadModel =
    store.pendingPreview?.overlayReadModel ??
    queryClient.getQueryData<Awaited<ReturnType<typeof planningApi.getPlanReadModel>>>(
      planKeys.project(projectId)
    );

  const undoApplied = useCallback(async () => {
    const commands = compensatingUndo.popUndo();
    if (commands.length === 0) return;
    await applyBatchMutation.mutateAsync(commands);
  }, [applyBatchMutation, compensatingUndo]);

  const redoApplied = useCallback(async () => {
    const commands = compensatingUndo.popRedo();
    if (commands.length === 0) return;
    await applyBatchMutation.mutateAsync(commands);
  }, [applyBatchMutation, compensatingUndo]);

  return {
    store,
    displayReadModel,
    preview: previewMutation.mutateAsync,
    apply: applyMutation.mutateAsync,
    applyBatch: applyBatchMutation.mutateAsync,
    cancelPreview: resetPending,
    undoPending,
    undoApplied,
    redoApplied,
    canUndoApplied: compensatingUndo.canUndo,
    canRedoApplied: compensatingUndo.canRedo,
    setApplyBarState,
    handleConflict,
    isPreviewing: previewMutation.isPending,
    isApplying: applyMutation.isPending || applyBatchMutation.isPending
  };
}
