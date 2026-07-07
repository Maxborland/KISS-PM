/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCallEngine, type CallEngineState } from "./call-engine";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const callClientMock = vi.hoisted(() => ({
  fetchCallRoomEntity: vi.fn(),
  fetchJoinToken: vi.fn(),
  fetchTurnCredentials: vi.fn(),
  joinOrStartCallSession: vi.fn(),
  persistCallMessage: vi.fn(),
  postParticipantState: vi.fn()
}));

const defaultLobbySelection = { cameraOn: false, micOn: true };

const livekitMock = vi.hoisted(() => {
  const instances: MockRoom[] = [];

  const ConnectionState = {
    Connecting: "connecting",
    Connected: "connected",
    Reconnecting: "reconnecting",
    Disconnected: "disconnected"
  } as const;

  const ConnectionQuality = {
    Excellent: "excellent",
    Good: "good",
    Poor: "poor",
    Lost: "lost"
  } as const;

  const RoomEvent = {
    ActiveSpeakersChanged: "ActiveSpeakersChanged",
    ConnectionQualityChanged: "ConnectionQualityChanged",
    ConnectionStateChanged: "ConnectionStateChanged",
    DataReceived: "DataReceived",
    Disconnected: "Disconnected",
    LocalTrackPublished: "LocalTrackPublished",
    LocalTrackUnpublished: "LocalTrackUnpublished",
    ParticipantConnected: "ParticipantConnected",
    ParticipantDisconnected: "ParticipantDisconnected",
    TrackMuted: "TrackMuted",
    TrackSubscribed: "TrackSubscribed",
    TrackUnmuted: "TrackUnmuted",
    TrackUnsubscribed: "TrackUnsubscribed"
  } as const;

  const Track = {
    Kind: { Audio: "audio" },
    Source: {
      Camera: "camera",
      Microphone: "microphone",
      ScreenShare: "screen_share"
    }
  } as const;

  class LocalVideoTrack {}

  class MockRoom {
    activeSpeakers = [];
    connect = vi.fn(async () => {
      this.state = ConnectionState.Connected;
    });
    disconnect = vi.fn(async () => {
      this.state = ConnectionState.Disconnected;
    });
    localParticipant = {
      connectionQuality: ConnectionQuality.Excellent,
      getTrackPublication: vi.fn(() => undefined),
      identity: "local-user",
      isCameraEnabled: false,
      isMicrophoneEnabled: false,
      isScreenShareEnabled: false,
      name: "Local User",
      publishData: vi.fn(),
      setCameraEnabled: vi.fn(async (enabled: boolean) => {
        this.localParticipant.isCameraEnabled = enabled;
      }),
      setMicrophoneEnabled: vi.fn(async (enabled: boolean) => {
        this.localParticipant.isMicrophoneEnabled = enabled;
      }),
      setScreenShareEnabled: vi.fn(async (enabled: boolean) => {
        this.localParticipant.isScreenShareEnabled = enabled;
      })
    };
    on = vi.fn(() => this);
    removeAllListeners = vi.fn();
    remoteParticipants = new Map();
    startAudio = vi.fn();
    state: (typeof ConnectionState)[keyof typeof ConnectionState] = ConnectionState.Disconnected;

    constructor() {
      instances.push(this);
    }
  }

  return {
    ConnectionQuality,
    ConnectionState,
    LocalVideoTrack,
    Room: MockRoom,
    RoomEvent,
    Track,
    instances
  };
});

vi.mock("@/lib/call/call-client", () => callClientMock);
vi.mock("@/lib/call/call-background", () => ({
  CallBackgroundController: vi.fn(() => ({
    bind: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
    setMode: vi.fn(async (mode: string) => mode)
  })),
  backgroundProcessorsSupported: vi.fn(() => false)
}));
vi.mock("livekit-client", () => livekitMock);

function EngineHarness(props: { roomId: string; onState?: ((state: CallEngineState) => void) | undefined }) {
  const state = useCallEngine(props.roomId, defaultLobbySelection);
  props.onState?.(state);
  return null;
}

async function renderEngine(roomId = "room-1", onState?: (state: CallEngineState) => void): Promise<{ root: Root; container: HTMLElement }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<EngineHarness roomId={roomId} onState={onState} />);
  });
  return { root, container };
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

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe("useCallEngine participant state lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    livekitMock.instances.length = 0;
    callClientMock.joinOrStartCallSession.mockResolvedValue({ id: "session-1" });
    callClientMock.fetchJoinToken.mockResolvedValue({
      joinUrl: "wss://livekit.example.test",
      provider: "livekit",
      token: "token-1"
    });
    callClientMock.fetchTurnCredentials.mockResolvedValue(null);
    callClientMock.fetchCallRoomEntity.mockResolvedValue(null);
    callClientMock.postParticipantState.mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("sends left once and disconnects the room when unmounted after a successful join", async () => {
    const { root } = await renderEngine();
    await waitForExpectation(() => {
      expect(callClientMock.postParticipantState).toHaveBeenCalledWith("room-1", "session-1", "joined");
    });

    await act(async () => {
      root.unmount();
    });

    expect(callClientMock.postParticipantState).toHaveBeenCalledTimes(2);
    expect(callClientMock.postParticipantState).toHaveBeenLastCalledWith("room-1", "session-1", "left");
    expect(livekitMock.instances[0]?.disconnect).toHaveBeenCalledTimes(1);
  });
  it("sends left only once when explicit leave is followed by unmount", async () => {
    let latestState: CallEngineState | null = null;
    const { root } = await renderEngine("room-1", (state) => {
      latestState = state;
    });
    await waitForExpectation(() => {
      expect(callClientMock.postParticipantState).toHaveBeenCalledWith("room-1", "session-1", "joined");
    });

    await act(async () => {
      latestState?.handlers.onLeave();
    });

    expect(callClientMock.postParticipantState).toHaveBeenCalledTimes(2);
    expect(callClientMock.postParticipantState).toHaveBeenLastCalledWith("room-1", "session-1", "left");

    await act(async () => {
      root.unmount();
    });

    expect(callClientMock.postParticipantState).toHaveBeenCalledTimes(2);
  });

  it("does not send left when unmounted before the room connects", async () => {
    const pendingSession = deferred<{ id: string }>();
    callClientMock.joinOrStartCallSession.mockReturnValueOnce(pendingSession.promise);
    const { root } = await renderEngine();

    await act(async () => {
      root.unmount();
    });

    expect(callClientMock.postParticipantState).not.toHaveBeenCalled();
    expect(livekitMock.instances[0]?.disconnect).toHaveBeenCalledTimes(1);
  });

  it("does not send left when the join token cannot connect to LiveKit", async () => {
    callClientMock.fetchJoinToken.mockResolvedValueOnce({
      joinUrl: "",
      provider: "none",
      token: null
    });
    const { root } = await renderEngine();

    await waitForExpectation(() => {
      expect(livekitMock.instances[0]?.disconnect).toHaveBeenCalledTimes(1);
    });

    expect(callClientMock.postParticipantState).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });

    expect(callClientMock.postParticipantState).not.toHaveBeenCalled();
  });
});