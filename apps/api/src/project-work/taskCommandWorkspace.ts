import { createTaskComment } from "./taskCommentCommands";
import {
  preflightCreateProjectTask,
  preflightCreateTaskComment,
  preflightCreateWorkspaceInboxTask,
  preflightTransitionTaskStatus,
  preflightUpdateTask
} from "./taskPreflightGuards";
import { archiveTask, transitionTaskStatus } from "./taskLifecycleCommands";
import type {
  ArchiveTaskInput,
  CreateProjectTaskInput,
  CreateTaskCommentInput,
  CreateWorkspaceInboxTaskInput,
  TaskCommandWorkspaceDeps,
  TransitionTaskStatusInput,
  UpdateTaskInput,
  WorkspaceInput
} from "./taskCommandTypes";
import { createProjectTask, createWorkspaceInboxTask } from "./taskCreateCommands";
import { updateTask } from "./taskUpdateCommands";

export function createTaskCommandWorkspace(deps: TaskCommandWorkspaceDeps) {
  return {
    preflightCreateWorkspaceInboxTask(input: WorkspaceInput) {
      return preflightCreateWorkspaceInboxTask(deps, input);
    },
    createWorkspaceInboxTask(input: CreateWorkspaceInboxTaskInput) {
      return createWorkspaceInboxTask(deps, input);
    },
    preflightCreateProjectTask(input: WorkspaceInput & { projectId: string }) {
      return preflightCreateProjectTask(deps, input);
    },
    createProjectTask(input: CreateProjectTaskInput) {
      return createProjectTask(deps, input);
    },
    preflightUpdateTask(input: WorkspaceInput & { taskId: string }) {
      return preflightUpdateTask(deps, input);
    },
    updateTask(input: UpdateTaskInput) {
      return updateTask(deps, input);
    },
    archiveTask(input: ArchiveTaskInput) {
      return archiveTask(deps, input);
    },
    preflightTransitionTaskStatus(input: WorkspaceInput & { projectId: string }) {
      return preflightTransitionTaskStatus(deps, input);
    },
    transitionTaskStatus(input: TransitionTaskStatusInput) {
      return transitionTaskStatus(deps, input);
    },
    preflightCreateTaskComment(input: WorkspaceInput & { taskId: string }) {
      return preflightCreateTaskComment(deps, input);
    },
    createTaskComment(input: CreateTaskCommentInput) {
      return createTaskComment(deps, input);
    }
  };
}

export type { TaskCommandWorkspaceDeps } from "./taskCommandTypes";
