"use client";

import { createLocalVideoTrack, type LocalVideoTrack, Room } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

import type { LobbyDevice, LobbySelection, VideoAttach } from "@/lib/call/types";

export type LobbyPreview = {
  cameras: LobbyDevice[];
  microphones: LobbyDevice[];
  selection: LobbySelection;
  permissionError: string | null;
  attachPreview: VideoAttach;
  setCamera: (deviceId: string) => void;
  setMicrophone: (deviceId: string) => void;
  toggleCamera: () => void;
  toggleMicrophone: () => void;
};

// SDK-side lobby preview: enumerates devices and drives a local camera preview
// track before the user joins. Lives under lib/call/* (the SDK boundary); the
// pure CallLobby widget only receives serialisable data + the attach callback.
export function useLobbyPreview(): LobbyPreview {
  const trackRef = useRef<LocalVideoTrack | null>(null);
  const elementRef = useRef<HTMLVideoElement | null>(null);
  const [cameras, setCameras] = useState<LobbyDevice[]>([]);
  const [microphones, setMicrophones] = useState<LobbyDevice[]>([]);
  const [selection, setSelection] = useState<LobbySelection>({ micOn: true, cameraOn: true });
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const stopPreview = useCallback(() => {
    const track = trackRef.current;
    if (track) {
      track.detach();
      track.stop();
      trackRef.current = null;
    }
  }, []);

  const startPreview = useCallback(
    async (deviceId?: string) => {
      stopPreview();
      try {
        const track = await createLocalVideoTrack(deviceId ? { deviceId } : {});
        trackRef.current = track;
        if (elementRef.current) track.attach(elementRef.current);
        setPermissionError(null);
      } catch (cause) {
        const denied = cause instanceof Error && cause.name === "NotAllowedError";
        setPermissionError(denied ? "Доступ к камере запрещён" : "Камера недоступна");
      }
    },
    [stopPreview]
  );

  const enumerate = useCallback(async () => {
    try {
      const [videoInputs, audioInputs] = await Promise.all([
        Room.getLocalDevices("videoinput"),
        Room.getLocalDevices("audioinput")
      ]);
      setCameras(videoInputs.map((device) => ({ deviceId: device.deviceId, label: device.label || "Камера" })));
      setMicrophones(audioInputs.map((device) => ({ deviceId: device.deviceId, label: device.label || "Микрофон" })));
      setSelection((previous) => ({
        ...previous,
        videoDeviceId: previous.videoDeviceId ?? videoInputs[0]?.deviceId,
        audioDeviceId: previous.audioDeviceId ?? audioInputs[0]?.deviceId
      }));
    } catch {
      // ignore enumeration errors
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await startPreview(undefined);
      await enumerate();
    })();
    return () => stopPreview();
  }, [startPreview, enumerate, stopPreview]);

  const attachPreview = useCallback<VideoAttach>((element) => {
    elementRef.current = element;
    if (element && trackRef.current) trackRef.current.attach(element);
  }, []);

  const setCamera = useCallback(
    (deviceId: string) => {
      setSelection((previous) => ({ ...previous, videoDeviceId: deviceId }));
      if (selection.cameraOn) void startPreview(deviceId);
    },
    [selection.cameraOn, startPreview]
  );

  const setMicrophone = useCallback((deviceId: string) => {
    setSelection((previous) => ({ ...previous, audioDeviceId: deviceId }));
  }, []);

  const toggleCamera = useCallback(() => {
    const next = !selection.cameraOn;
    setSelection((previous) => ({ ...previous, cameraOn: next }));
    if (next) void startPreview(selection.videoDeviceId);
    else stopPreview();
  }, [selection.cameraOn, selection.videoDeviceId, startPreview, stopPreview]);

  const toggleMicrophone = useCallback(() => {
    setSelection((previous) => ({ ...previous, micOn: !previous.micOn }));
  }, []);

  return {
    cameras,
    microphones,
    selection,
    permissionError,
    attachPreview,
    setCamera,
    setMicrophone,
    toggleCamera,
    toggleMicrophone
  };
}
