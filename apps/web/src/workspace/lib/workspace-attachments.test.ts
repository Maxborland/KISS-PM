import { describe, it, expect } from "vitest";

import { createMockWorkspaceFetch } from "./mock-workspace-backend";
import { WorkspaceApiError, createWorkspaceClient } from "./workspace-client";

// Задача из сида мока (proj-prod-portal-r2), к которой прикладываем/скачиваем/удаляем файл.
const TASK_ID = "task-r2-requirements";

function client() {
  return createWorkspaceClient({ apiOrigin: "", fetchImpl: createMockWorkspaceFetch() });
}

function textFile(name: string, content: string) {
  return new File([content], name, { type: "text/plain" });
}

describe("workspace attachments client", () => {
  it("lists no attachments for a task before anything is uploaded", async () => {
    const c = client();
    const { attachments } = await c.listTaskAttachments(TASK_ID);
    expect(attachments).toEqual([]);
  });

  it("uploads a file and then lists it for the task (entityType=task binding)", async () => {
    const c = client();
    const uploaded = await c.uploadTaskAttachment(TASK_ID, textFile("тз.txt", "содержимое"));
    expect(uploaded.attachment.kind).toBe("file");
    expect(uploaded.attachment.entityType).toBe("task");
    expect(uploaded.attachment.entityId).toBe(TASK_ID);
    expect(uploaded.attachment.fileAsset?.safeDisplayName).toBe("тз.txt");

    const { attachments } = await c.listTaskAttachments(TASK_ID);
    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.id).toBe(uploaded.attachment.id);
  });

  it("surfaces the uploaded attachment in the task detail attachmentItems", async () => {
    const c = client();
    const uploaded = await c.uploadTaskAttachment(TASK_ID, textFile("скрин.txt", "x"));
    const detail = await c.getTaskDetail(TASK_ID);
    expect(detail.attachmentItems.map((item) => item.id)).toContain(uploaded.attachment.id);
  });

  it("downloads the attachment bytes with a filename from Content-Disposition", async () => {
    const c = client();
    const uploaded = await c.uploadTaskAttachment(TASK_ID, textFile("report.txt", "полезная нагрузка"));
    const { blob, filename } = await c.downloadTaskAttachment(uploaded.attachment.id);
    expect(filename).toBe("report.txt");
    expect(await blob.text()).toBe("полезная нагрузка");
  });

  it("archives (deletes) the attachment so it drops out of the list", async () => {
    const c = client();
    const uploaded = await c.uploadTaskAttachment(TASK_ID, textFile("draft.txt", "y"));
    const removed = await c.deleteTaskAttachment(uploaded.attachment.id);
    expect(removed.attachment.archivedAt).not.toBeNull();

    const { attachments } = await c.listTaskAttachments(TASK_ID);
    expect(attachments).toEqual([]);
  });

  it("throws a typed error when downloading an unknown attachment (404 attachment_not_found)", async () => {
    const c = client();
    await expect(c.downloadTaskAttachment("att-does-not-exist")).rejects.toMatchObject({
      code: "attachment_not_found",
      status: 404
    });
    // Убеждаемся, что это именно транспортная доменная ошибка клиента.
    await c.downloadTaskAttachment("att-missing").catch((e) => {
      expect(e).toBeInstanceOf(WorkspaceApiError);
    });
  });

  it("rejects an upload without a task-shaped entity id (400 attachment_entity_id_invalid)", async () => {
    const c = client();
    await expect(c.uploadTaskAttachment("!!", textFile("bad.txt", "z"))).rejects.toMatchObject({
      code: "attachment_entity_id_invalid",
      status: 400
    });
  });
});
