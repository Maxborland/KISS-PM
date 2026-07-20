import { describe, expect, it } from "vitest";

import type { AgentMessage } from "@/workspace/agent/agent-model";
import { dedupeMessagesById } from "./agent-messages";

const user = (id: string, text = "u"): AgentMessage => ({ id, role: "user", time: "", text });
const agent = (id: string, text = "a"): AgentMessage => ({ id, role: "agent", time: "", text });

describe("dedupeMessagesById", () => {
  it("схлопывает дубли по id, сохраняя первое вхождение и порядок", () => {
    const turnId = "message-agent-turn-8c3bc55c";
    const messages = [user("u1"), agent(turnId, "первый"), user("u2"), agent(turnId, "дубль SSE")];
    const out = dedupeMessagesById(messages);
    expect(out.map((m) => m.id)).toEqual(["u1", turnId, "u2"]);
    // Осталось первое вхождение turnId (не поздний дубль стрима).
    const kept = out.find((m) => m.id === turnId);
    expect(kept && "text" in kept ? kept.text : null).toBe("первый");
  });

  it("не меняет список без дублей", () => {
    const messages = [user("u1"), agent("a1"), user("u2")];
    expect(dedupeMessagesById(messages)).toEqual(messages);
  });

  it("пустой список → пустой", () => {
    expect(dedupeMessagesById([])).toEqual([]);
  });
});
