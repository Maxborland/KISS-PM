/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLobbyPreview, type LobbyPreview } from "./use-lobby-preview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const livekitMock = vi.hoisted(() => ({
  createLocalVideoTrack: vi.fn(),
  Room: {
    getLocalDevices: vi.fn()
  }
}));

vi.mock("livekit-client", () => livekitMock);

function PreviewHarness(props: { onState: (state: LobbyPreview) => void }) {
  props.onState(useLobbyPreview());
  return null;
}

async function renderPreview(onState: (state: LobbyPreview) => void): Promise<{ root: Root }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<PreviewHarness onState={onState} />);
  });
  return { root };
}

async function waitForExpectation(assertExpectation: () => void): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertExpectation();
      return;
    } catch (cause) {
      lastError = cause;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }
  throw lastError;
}

describe("useLobbyPreview degraded camera permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    livekitMock.Room.getLocalDevices.mockResolvedValue([]);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("turns the lobby camera off and keeps joinable state when camera permission is denied", async () => {
    const denied = new Error("denied");
    denied.name = "NotAllowedError";
    livekitMock.createLocalVideoTrack.mockRejectedValueOnce(denied);
    let latestState: LobbyPreview | null = null;

    const { root } = await renderPreview((state) => {
      latestState = state;
    });

    await waitForExpectation(() => {
      expect(latestState?.permissionError).toBe("Доступ к камере запрещён");
      expect(latestState?.selection.cameraOn).toBe(false);
      expect(latestState?.selection.micOn).toBe(true);
    });

    await act(async () => {
      root.unmount();
    });
  });
});
