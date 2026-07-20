// @vitest-environment happy-dom

import { act, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskActivityRecord, TaskAttachment, TaskDetailResponse, TaskRecord } from "@/workspace/lib/workspace-client";
import { TaskDetailSurface } from "./task-detail-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const harness = vi.hoisted(() => ({
  data: null as TaskDetailResponse | null,
  uploadAttachment: vi.fn(),
  downloadAttachment: vi.fn(),
  deleteAttachment: vi.fn()
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));
vi.mock("@/delivery/ui/workspace-shell", () => ({
  WorkspaceShell: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock("@/components/domain/surface-state", () => ({
  SurfaceState: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock("@/components/domain/form-dialog", () => ({
  FormDialog: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>
}));
vi.mock("./task-peek", () => ({
  taskPeekRecordFromWorkspace: (task: TaskRecord) => task,
  TaskPeekDetails: () => null
}));
vi.mock("@/workspace/lib/use-workspace", () => ({
  useTaskDetail: () => ({
    data: harness.data,
    status: "ready",
    error: null,
    reload: vi.fn(),
    notFound: false,
    updateTask: vi.fn(),
    createComment: vi.fn(),
    uploadAttachment: harness.uploadAttachment,
    downloadAttachment: harness.downloadAttachment,
    deleteAttachment: harness.deleteAttachment
  })
}));

const task = {
  id: "task-detail-1",
  projectId: "proj-detail-1",
  title: "Согласовать требования",
  plannedWork: 40,
  updatedAt: "2026-07-01T00:00:00.000Z"
} as TaskRecord;

const fileAttachment = (over: Partial<TaskAttachment> = {}): TaskAttachment => ({
  id: "att-1",
  entityType: "task",
  entityId: task.id,
  relationType: "attachment",
  kind: "file",
  fileAsset: {
    id: "fa-1",
    originalName: "тз.pdf",
    safeDisplayName: "тз.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    checksumSha256: "",
    status: "ready",
    createdAt: "2026-07-01T00:00:00.000Z"
  },
  externalReference: null,
  sourceActivityType: null,
  sourceActivityId: null,
  createdByUserId: "u-petrov",
  createdAt: "2026-07-01T00:00:00.000Z",
  archivedAt: null,
  ...over
});

const detail = (over: Partial<TaskDetailResponse> = {}): TaskDetailResponse => ({
  task,
  projectId: "proj-detail-1",
  projectName: "Производственный портал",
  activities: [],
  attachmentItems: [],
  ...over
});

const buttonByText = (label: string): HTMLButtonElement | undefined =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined;

describe("TaskDetailSurface navigation", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("links the task to its project page and back to «Мои задачи»", async () => {
    harness.data = detail();
    await act(async () => root.render(<TaskDetailSurface taskId={task.id} />));

    const projectLink = document.querySelector('a[href="/projects/proj-detail-1"]');
    expect(projectLink?.textContent).toBe("Производственный портал");

    const myWorkLink = document.querySelector('a[href="/my-work"]');
    expect(myWorkLink?.textContent).toContain("Мои задачи");
  });

  it("keeps the project link honest when projectName is unavailable (fail-soft)", async () => {
    harness.data = detail({ projectName: null });
    await act(async () => root.render(<TaskDetailSurface taskId={task.id} />));

    const projectLink = document.querySelector('a[href="/projects/proj-detail-1"]');
    expect(projectLink?.textContent).toBe("Открыть проект");
  });
});

describe("TaskDetailSurface attachments", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    harness.uploadAttachment.mockReset().mockResolvedValue({ ok: true });
    harness.downloadAttachment.mockReset().mockResolvedValue({ ok: true, data: { blob: new Blob(["x"]), filename: "тз.pdf" } });
    harness.deleteAttachment.mockReset().mockResolvedValue({ ok: true });
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => "blob:mock");
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("shows an honest empty state when the task has no attachments", async () => {
    harness.data = detail({ attachmentItems: [] });
    await act(async () => root.render(<TaskDetailSurface taskId={task.id} />));
    expect(host.textContent).toContain("Файлы к задаче ещё не прикреплены.");
  });

  it("renders each attached file with a name, size and download/delete controls", async () => {
    harness.data = detail({ attachmentItems: [fileAttachment()] });
    await act(async () => root.render(<TaskDetailSurface taskId={task.id} />));
    expect(host.textContent).toContain("тз.pdf");
    expect(host.textContent).toContain("2.0 КБ");
    expect(buttonByText("Скачать")).toBeTruthy();
    expect(buttonByText("Удалить")).toBeTruthy();
  });

  it("hides archived attachments from the list", async () => {
    harness.data = detail({ attachmentItems: [fileAttachment({ archivedAt: "2026-07-02T00:00:00.000Z" })] });
    await act(async () => root.render(<TaskDetailSurface taskId={task.id} />));
    expect(host.textContent).not.toContain("тз.pdf");
    expect(host.textContent).toContain("Файлы к задаче ещё не прикреплены.");
  });

  it("downloads a file through the client and triggers a browser download", async () => {
    harness.data = detail({ attachmentItems: [fileAttachment()] });
    await act(async () => root.render(<TaskDetailSurface taskId={task.id} />));
    await act(async () => { buttonByText("Скачать")!.click(); });
    expect(harness.downloadAttachment).toHaveBeenCalledWith("att-1");
    expect((URL as unknown as { createObjectURL: ReturnType<typeof vi.fn> }).createObjectURL).toHaveBeenCalled();
  });

  it("deletes a file through the client", async () => {
    harness.data = detail({ attachmentItems: [fileAttachment()] });
    await act(async () => root.render(<TaskDetailSurface taskId={task.id} />));
    await act(async () => { buttonByText("Удалить")!.click(); });
    expect(harness.deleteAttachment).toHaveBeenCalledWith("att-1");
  });

  it("shows a honest error toast with the server code when download fails", async () => {
    harness.downloadAttachment.mockResolvedValue({ ok: false, code: "attachment_not_found", message: "attachment_not_found" });
    harness.data = detail({ attachmentItems: [fileAttachment()] });
    await act(async () => root.render(<TaskDetailSurface taskId={task.id} />));
    await act(async () => { buttonByText("Скачать")!.click(); });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Вложение больше недоступно");
  });

  it("uploads the selected file via the hidden input", async () => {
    harness.data = detail({ attachmentItems: [] });
    await act(async () => root.render(<TaskDetailSurface taskId={task.id} />));
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["data"], "screen.png", { type: "image/png" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(harness.uploadAttachment).toHaveBeenCalledTimes(1);
    expect(harness.uploadAttachment.mock.calls[0]?.[0]).toBe(file);
  });

  it("renders a download link for file-type activity entries", async () => {
    const fileActivity: TaskActivityRecord = {
      id: "act-file-1",
      taskId: task.id,
      type: "file",
      body: null,
      title: "Загрузка ТЗ",
      fileUrl: "/api/workspace/attachments/att-1/download",
      fileSizeBytes: 2048,
      mimeType: "application/pdf",
      authorUserId: "u-petrov",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z"
    };
    harness.data = detail({ activities: [fileActivity] });
    await act(async () => root.render(<TaskDetailSurface taskId={task.id} />));
    const link = host.querySelector('a[href="/api/workspace/attachments/att-1/download"]');
    expect(link?.getAttribute("download")).not.toBeNull();
    expect(link?.textContent).toContain("Скачать файл");
  });
});
