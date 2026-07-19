import { describe, expect, it } from "vitest";

import { appendIncomingMessage, replaceChannelInList, type ConversationData } from "./use-comms";
import type { Channel, Message } from "./comms-client";

const channel = (id: string, title: string): Channel => ({
  id,
  channelType: "team",
  title,
  description: "",
  scopeEntityType: "org_unit",
  scopeEntityId: "org-alpha",
  canManage: true,
  createdByUserId: "u-admin",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  archivedAt: null
});

describe("communication channel list state", () => {
  it("replaces a renamed channel in the list without dropping other channels", () => {
    const first = channel("channel-a", "Alpha");
    const second = channel("channel-b", "Beta");
    const renamed = { ...second, title: "Beta edited", updatedAt: "2026-01-02T00:00:00.000Z" };

    expect(replaceChannelInList([first, second], renamed)).toEqual([first, renamed]);
  });

  it("keeps the list unchanged when the patched channel is not present", () => {
    const list = [channel("channel-a", "Alpha")];

    expect(replaceChannelInList(list, channel("channel-missing", "Missing"))).toBe(list);
  });
});

/* ============================================================
   P8 realtime: appendIncomingMessage — вставка SSE-кадра message.created
   в load-state беседы (дедуп по id, кадр чужой беседы — no-op).
   ============================================================ */
const message = (id: string, conversationId: string): Message => ({
  id,
  tenantId: "tenant-alpha",
  conversationId,
  authorUserId: "u-sergey",
  body: `Сообщение ${id}`,
  metadata: {},
  createdAt: "2026-01-12T09:00:00.000Z",
  editedAt: null,
  archivedAt: null,
  pinnedAt: null,
  pinnedByUserId: null,
  reactions: [],
  stickers: []
});

const conversationData = (selectedId: string, messages: Message[]): ConversationData => ({
  conversations: [],
  selectedConversationId: selectedId,
  messages,
  nextCursor: null
});

describe("appendIncomingMessage (realtime message.created)", () => {
  it("добавляет входящее сообщение активной беседы в конец ленты", () => {
    const data = conversationData("conv-a", [message("m-1", "conv-a")]);
    const incoming = message("m-2", "conv-a");

    const next = appendIncomingMessage(data, incoming);

    expect(next?.messages.map((m) => m.id)).toEqual(["m-1", "m-2"]);
  });

  it("дедуплицирует по id: echo собственного сообщения не добавляется второй раз", () => {
    const data = conversationData("conv-a", [message("m-1", "conv-a")]);

    expect(appendIncomingMessage(data, message("m-1", "conv-a"))).toBe(data);
  });

  it("игнорирует кадр чужой беседы и пустой state", () => {
    const data = conversationData("conv-a", []);

    expect(appendIncomingMessage(data, message("m-1", "conv-b"))).toBe(data);
    expect(appendIncomingMessage(null, message("m-1", "conv-a"))).toBeNull();
  });
});
