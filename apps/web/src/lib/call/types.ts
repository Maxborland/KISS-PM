// View-model contract shared by the static Storybook twin and the live runtime
// container. PURE DATA — no `livekit-client` types leak above this module, so the
// call widgets stay SDK-free and SSR/Storybook-safe.

export type CallPhase =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export type MediaState = "on" | "off";

export type QualityLevel = "excellent" | "good" | "poor" | "lost" | "unknown";

export type BackgroundMode = "none" | "blur" | "image";

/**
 * Attach/detach callback supplied by the engine for a live video track. The
 * widget only renders a <video> and hands its element here; it never imports the
 * media SDK. Mocks omit this so the tile falls back to the avatar.
 */
export type VideoAttach = (element: HTMLVideoElement | null) => void;

export type ParticipantTileView = {
  id: string;
  name: string;
  initials: string;
  color: "c1" | "c2" | "c3" | "c4" | "c5";
  camera: MediaState;
  mic: MediaState;
  speaking?: boolean;
  sharingScreen?: boolean;
  quality?: QualityLevel;
  self?: boolean;
  attachVideo?: VideoAttach;
};

export type CallStageView = {
  phase: CallPhase;
  participants: ParticipantTileView[];
};

export type CallLocalControls = {
  micOn: boolean;
  cameraOn: boolean;
  screenShareOn?: boolean;
  background?: BackgroundMode | undefined;
  backgroundSupported?: boolean | undefined;
};

export type CallControlHandlers = {
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onCycleBackground?: () => void;
  onLeave: () => void;
};

export type LobbyDevice = { deviceId: string; label: string };

export type LobbySelection = {
  audioDeviceId?: string | undefined;
  videoDeviceId?: string | undefined;
  micOn: boolean;
  cameraOn: boolean;
};
