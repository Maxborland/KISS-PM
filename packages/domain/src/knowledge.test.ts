import { describe, expect, it } from "vitest";

import {
  parseKnowledgeActionTargetType,
  parseKnowledgeBody,
  parseKnowledgeDocumentType,
  parseKnowledgeDueDate,
  parseKnowledgeId,
  parseKnowledgeTitle
} from "./knowledge";

describe("knowledge domain parsers", () => {
  it("accepts bounded project knowledge fields", () => {
    expect(parseKnowledgeId("knowledge-doc-1")).toEqual({ ok: true, value: "knowledge-doc-1" });
    expect(parseKnowledgeTitle("  Решение по интеграции  ")).toEqual({
      ok: true,
      value: "Решение по интеграции"
    });
    expect(parseKnowledgeBody("Текст протокола")).toEqual({ ok: true, value: "Текст протокола" });
    expect(parseKnowledgeDocumentType("meeting_minutes")).toEqual({
      ok: true,
      value: "meeting_minutes"
    });
    expect(parseKnowledgeDueDate("2026-05-26")).toEqual({ ok: true, value: "2026-05-26" });
    expect(parseKnowledgeActionTargetType("task")).toEqual({ ok: true, value: "task" });
  });

  it("rejects traversal ids, control characters and invalid enums", () => {
    expect(parseKnowledgeId("../secret")).toEqual({ ok: false, error: "knowledge_id_invalid" });
    expect(parseKnowledgeTitle("bad\u0001title")).toEqual({
      ok: false,
      error: "knowledge_title_invalid"
    });
    expect(parseKnowledgeDocumentType("spreadsheet")).toEqual({
      ok: false,
      error: "knowledge_document_type_invalid"
    });
    expect(parseKnowledgeDueDate("26.05.2026")).toEqual({
      ok: false,
      error: "knowledge_action_due_date_invalid"
    });
    expect(parseKnowledgeDueDate("2026-02-31")).toEqual({
      ok: false,
      error: "knowledge_action_due_date_invalid"
    });
    expect(parseKnowledgeDueDate("2026-13-01")).toEqual({
      ok: false,
      error: "knowledge_action_due_date_invalid"
    });
  });
});
