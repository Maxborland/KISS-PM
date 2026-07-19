// @vitest-environment happy-dom

/* ============================================================
   Н9: runtime-проба MediaPipe-активов для контрола «Фон».
   Контракт: backgroundAssetsAvailable() == true ТОЛЬКО когда все
   обязательные активы (/livekit/wasm/* + selfie_segmenter.tflite)
   реально отдаются сервером как бинарники. Любой отказ (404, HTML
   SPA-fallback, сетевая ошибка) ⇒ false ⇒ контрол не притворяется
   рабочим (молчаливый no-op эффекта исключён на уровне UI-гейта).
   ============================================================ */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* Медиа-SDK не нужен для пробы активов — мокаем, чтобы не тянуть pipeline в happy-dom. */
vi.mock("@livekit/track-processors", () => ({
  BackgroundProcessor: vi.fn(),
  supportsBackgroundProcessors: vi.fn(() => true)
}));

import {
  BACKGROUND_ASSET_PROBE_PATHS,
  backgroundAssetsAvailable,
  resetBackgroundAssetsProbeForTests
} from "./call-background";

type FetchMock = ReturnType<typeof vi.fn>;

function headResponse(ok: boolean, contentType: string): Response {
  return {
    ok,
    headers: new Headers({ "content-type": contentType })
  } as unknown as Response;
}

describe("backgroundAssetsAvailable: честный гейт по наличию активов", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: FetchMock;

  beforeEach(() => {
    resetBackgroundAssetsProbeForTests();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetBackgroundAssetsProbeForTests();
  });

  it("все активы на месте (HEAD ok, бинарный content-type) → true; опрошены все пути", async () => {
    fetchMock.mockResolvedValue(headResponse(true, "application/octet-stream"));

    await expect(backgroundAssetsAvailable()).resolves.toBe(true);

    const requested = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(requested.sort()).toEqual([...BACKGROUND_ASSET_PROBE_PATHS].sort());
    for (const call of fetchMock.mock.calls) {
      expect((call[1] as RequestInit).method).toBe("HEAD");
    }
    // Проба покрывает и WASM-рантайм, и модель сегментации.
    expect(BACKGROUND_ASSET_PROBE_PATHS).toContain("/livekit/selfie_segmenter.tflite");
    expect(
      BACKGROUND_ASSET_PROBE_PATHS.some((path) => path.startsWith("/livekit/wasm/"))
    ).toBe(true);
  });

  it("модель отсутствует (404 на .tflite) → false", async () => {
    fetchMock.mockImplementation(async (path: string) =>
      path.endsWith(".tflite")
        ? headResponse(false, "text/plain")
        : headResponse(true, "application/octet-stream")
    );

    await expect(backgroundAssetsAvailable()).resolves.toBe(false);
  });

  it("SPA-fallback (200, но text/html вместо бинарника) → false", async () => {
    fetchMock.mockResolvedValue(headResponse(true, "text/html; charset=utf-8"));

    await expect(backgroundAssetsAvailable()).resolves.toBe(false);
  });

  it("сетевая ошибка пробы → false (без исключения наружу)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(backgroundAssetsAvailable()).resolves.toBe(false);
  });

  it("результат кэшируется: повторный вызов не дёргает сеть заново", async () => {
    fetchMock.mockResolvedValue(headResponse(true, "application/wasm"));

    await backgroundAssetsAvailable();
    const callsAfterFirst = fetchMock.mock.calls.length;
    await backgroundAssetsAvailable();

    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });
});
