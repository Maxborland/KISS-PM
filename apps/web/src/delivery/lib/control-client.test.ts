import { describe, expect, it, vi } from "vitest";

import { DomainApiError } from "../../lib/domain-client";

import { controlErr, createControlClient, mapControlError } from "./control-client";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

function clientWith(fetchImpl: typeof fetch) {
  return createControlClient({ fetchImpl });
}

describe("createControlClient", () => {
  it("reads the control read-model from the project route", async () => {
    const body = { definitions: [], evaluations: [], signals: [], correctiveActions: [], actionExecutions: [] };
    const fetchImpl = vi.fn(async () => jsonResponse(body));
    const model = await clientWith(fetchImpl as unknown as typeof fetch).getReadModel("project 1");

    expect(model).toEqual(body);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/workspace/projects/project%201/control/read-model");
    expect(init.method).toBeUndefined();
    expect(init.credentials).toBe("same-origin");
  });

  it("sends preview and apply to the management-action routes with clientPlanVersion", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    const client = clientWith(fetchImpl as unknown as typeof fetch);

    await client.previewAction("p-1", "sig-1", "act-1");
    await client.applyAction("p-1", "sig-1", "act-1", 7);

    const [previewUrl, previewInit] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(previewUrl).toBe("/api/workspace/projects/p-1/control/signals/sig-1/actions/act-1/preview");
    expect(previewInit.method).toBe("POST");

    const [applyUrl, applyInit] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(applyUrl).toBe("/api/workspace/projects/p-1/control/signals/sig-1/actions/act-1/apply");
    expect(applyInit.method).toBe("POST");
    expect(JSON.parse(String(applyInit.body))).toEqual({ clientPlanVersion: 7 });
  });

  it("posts signal status with the accepted-risk reason only when provided", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    const client = clientWith(fetchImpl as unknown as typeof fetch);

    await client.setSignalStatus("p-1", "sig-1", "resolved");
    await client.setSignalStatus("p-1", "sig-1", "accepted_risk", "согласовано с РП");

    const [, resolvedInit] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(resolvedInit.body))).toEqual({ status: "resolved" });
    const [statusUrl, riskInit] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(statusUrl).toBe("/api/workspace/projects/p-1/control/signals/sig-1/status");
    expect(JSON.parse(String(riskInit.body))).toEqual({
      status: "accepted_risk",
      acceptedRiskReason: "согласовано с РП"
    });
  });

  it("creates corrective actions on the signal route", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    await clientWith(fetchImpl as unknown as typeof fetch).createCorrectiveAction("p-1", "sig-1", {
      title: "Пересогласовать сроки",
      dueDate: "2026-08-01"
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/workspace/projects/p-1/control/signals/sig-1/corrective-actions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ title: "Пересогласовать сроки", dueDate: "2026-08-01" });
  });

  it("reads the retrospective from the closure route", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ snapshot: null, lessons: [], templateImprovementActions: [] })
    );
    const view = await clientWith(fetchImpl as unknown as typeof fetch).getRetrospective("p-1");

    expect(view.snapshot).toBeNull();
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toBe("/api/workspace/projects/p-1/closure");
  });

  it("preserves the raw server error code as DomainApiError", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "plan_version_conflict", currentPlanVersion: 9 }, 409));
    const error = await clientWith(fetchImpl as unknown as typeof fetch)
      .applyAction("p-1", "sig-1", "act-1", 7)
      .then(
        () => null,
        (raised: unknown) => raised
      );

    expect(error).toBeInstanceOf(DomainApiError);
    expect(error).toMatchObject({ status: 409, code: "plan_version_conflict" });
  });
});

describe("mapControlError", () => {
  it("maps known codes to honest russian messages with the raw code preserved", () => {
    const mapped = mapControlError(new DomainApiError(409, "plan_version_conflict", {}), "apply_failed");
    expect(mapped).toEqual({
      code: "plan_version_conflict",
      message: "План уже изменился. Данные обновлены, повторите действие",
      status: 409
    });
  });

  it("falls back to the operation message for unknown codes and to status texts otherwise", () => {
    expect(mapControlError(new DomainApiError(500, "boom_unknown", {}), "apply_failed").message).toBe(
      "Не удалось применить действие"
    );
    expect(mapControlError(new DomainApiError(403, "some_new_denial", {}), "apply_failed").message).toBe(
      "Недостаточно прав для контура управления проектом"
    );
    expect(mapControlError(new TypeError("fetch failed"), "load_failed").code).toBe("transport_failure");
  });

  it("controlErr formats load errors for SurfaceState", () => {
    expect(controlErr("permission_missing")).toBe("Недостаточно прав для контура управления проектом");
    expect(controlErr()).toBe("Не удалось загрузить контур управления");
  });
});
