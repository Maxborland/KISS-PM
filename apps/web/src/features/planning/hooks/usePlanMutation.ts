"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import { PlanningApiError } from "@kiss-pm/planning-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import { invalidateWorkspaceCapacityQueries } from "../capacity/invalidateWorkspaceCapacityQueries";
import { planningApi } from "../planningApi";
import {
  initialPlanMutationStore,
  type ApplyBarState,
  type PendingPreview,
  type PlanMutationStore
} from "./planMutationState";
import { planKeys } from "./planKeys";
import { useCompensatingUndo } from "./useCompensatingUndo";

type PlanSnapshot = Awaited<ReturnType<typeof planningApi.getPlanReadModel>>;

export function usePlanMutation(projectId: string) {
  const queryClient = useQueryClient();
  const [store, setStore] = useState<PlanMutationStore>(initialPlanMutationStore);
  const compensatingUndo = useCompensatingUndo();
  const previewGenerationRef = useRef(0);
  const previewAbortRef = useRef<AbortController | null>(null);

  const setApplyBarState = useCallback((applyBarState: ApplyBarState, errorMessage: string | null = null) => {
    setStore((current) => ({ ...current, applyBarState, errorMessage }));
  }, []);

  const resetPending = useCallback(() => {
    setStore(initialPlanMutationStore);
  }, []);

  const handleConflict = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: planKeys.project(projectId) });
    invalidateWorkspaceCapacityQueries(queryClient);
    setStore((current) => ({
      ...initialPlanMutationStore,
      applyBarState: "conflict",
      errorMessage: "План обновлён другим пользователем. Данные перезагружены.",
      previewStale: current.pendingPreview !== null
    }));
  }, [projectId, queryClient]);

  const markPreviewStale = useCallback(() => {
    setStore((current) => {
      if (!current.pendingPreview) return current;
      return { ...current, previewStale: true };
    });
  }, []);

  const readLoadedSnapshot = useCallback((): PlanSnapshot | undefined => {
    return queryClient.getQueryData<PlanSnapshot>(planKeys.project(projectId));
  }, [projectId, queryClient]);

  const handleMutationError = useCallback(
    async (error: unknown, fallbackMessage: string) => {
      if (error instanceof PlanningApiError && error.code === "plan_version_conflict") {
        await handleConflict();
        return;
      }
      setApplyBarState(
        "error",
        error instanceof Error ? error.message : fallbackMessage
      );
    },
    [handleConflict, setApplyBarState]
  );

  const previewMutation = useMutation({
    mutationFn: async (input: { command: PlanningCommand; generation: number }) => {
      const snapshot = readLoadedSnapshot();
      if (!snapshot) throw new Error("plan_not_loaded");
      previewAbortRef.current?.abort();
      const controller = new AbortController();
      previewAbortRef.current = controller;
      try {
        return await planningApi.previewCommand(
          projectId,
          {
            command: input.command,
            clientPlanVersion: snapshot.planVersion
          },
          controller.signal
        );
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error("preview_aborted");
        }
        throw error;
      } finally {
        if (previewAbortRef.current === controller) {
          previewAbortRef.current = null;
        }
      }
    },
    onMutate: async (input: { command: PlanningCommand; generation: number }) => {
      void input;
      setStore((current) => ({
        ...current,
        applyBarState: "preview-pending",
        previewStale: false,
        errorMessage: null
      }));
    },
    onSuccess: (preview, input) => {
      if (input.generation !== previewGenerationRef.current) return;
      const command = input.command;
      const snapshot = readLoadedSnapshot();
      const entry: PendingPreview = {
        command,
        preview,
        overlayReadModel: preview.after,
        basePlanVersion: snapshot?.planVersion ?? preview.before.planVersion
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
    onError: (error, input) => {
      if (input.generation !== previewGenerationRef.current) return;
      if (error instanceof Error && error.message === "preview_aborted") return;
      void handleMutationError(error, "Не удалось рассчитать превью");
    }
  });

  const preview = useCallback(
    async (command: PlanningCommand) => {
      const generation = ++previewGenerationRef.current;
      return previewMutation.mutateAsync({ command, generation });
    },
    [previewMutation]
  );

  const applyMutation = useMutation({
    mutationFn: async () => {
      const pending = store.pendingPreview;
      const snapshot = readLoadedSnapshot();
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
            before: current.pendingPreview.preview.before
          });
        }
        return { ...initialPlanMutationStore, applyBarState: "applied" };
      });
      queryClient.setQueryData(planKeys.project(projectId), result.readModel);
      invalidateWorkspaceCapacityQueries(queryClient);
      window.setTimeout(() => setApplyBarState("idle"), 3000);
    },
    onError: (error) => {
      void handleMutationError(error, "Не удалось применить изменения");
    }
  });

  const applyBatchMutation = useMutation({
    mutationFn: async (commands: PlanningCommand[]) => {
      const snapshot = readLoadedSnapshot();
      if (!snapshot) throw new Error("plan_not_loaded");
      return planningApi.applyCommandBatch(projectId, {
        commands,
        clientPlanVersion: snapshot.planVersion,
        idempotencyKey: crypto.randomUUID()
      });
    },
    onMutate: () => setApplyBarState("applying"),
    onSuccess: (result, commands) => {
      const snapshot = readLoadedSnapshot();
      if (snapshot && commands.length === 1) {
        compensatingUndo.pushApplied({
          command: commands[0]!,
          before: snapshot
        });
      }
      queryClient.setQueryData(planKeys.project(projectId), result.readModel);
      invalidateWorkspaceCapacityQueries(queryClient);
      resetPending();
      setApplyBarState("applied");
      window.setTimeout(() => setApplyBarState("idle"), 3000);
    },
    onError: (error) => {
      void handleMutationError(error, "Не удалось применить пакет изменений");
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

  const loadedSnapshot = readLoadedSnapshot();
  const displayReadModel = store.pendingPreview?.overlayReadModel ?? loadedSnapshot;

  const previewStale =
    store.previewStale ||
    (store.pendingPreview !== null &&
      loadedSnapshot !== undefined &&
      loadedSnapshot.planVersion !== store.pendingPreview.basePlanVersion);

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
    previewStale,
    displayReadModel,
    preview,
    markPreviewStale,
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
