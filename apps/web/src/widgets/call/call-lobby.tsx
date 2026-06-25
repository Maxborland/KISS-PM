"use client";

import { Camera, CameraOff, Mic, MicOff } from "lucide-react";
import { useEffect, useRef } from "react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { Field, FormGrid } from "@/components/domain/form-layout";
import { BannerInline } from "@/components/ui/banner-inline";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import type { LobbyDevice, LobbySelection, VideoAttach } from "@/lib/call/types";

export type CallLobbyProps = {
  cameras: LobbyDevice[];
  microphones: LobbyDevice[];
  selection: LobbySelection;
  permissionError: string | null;
  attachPreview: VideoAttach;
  onCamera: (deviceId: string) => void;
  onMicrophone: (deviceId: string) => void;
  onToggleCamera: () => void;
  onToggleMicrophone: () => void;
  onJoin: () => void;
};

// Pure pre-join lobby. The live preview track is attached via the opaque
// attachPreview callback (engine-side); this widget imports no media SDK.
export function CallLobby({
  cameras,
  microphones,
  selection,
  permissionError,
  attachPreview,
  onCamera,
  onMicrophone,
  onToggleCamera,
  onToggleMicrophone,
  onJoin
}: CallLobbyProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    attachPreview(videoRef.current);
    return () => attachPreview(null);
  }, [attachPreview, selection.cameraOn]);

  return (
    <div className="call-screen">
      <div className="call-lobby">
        <div className="call-tile call-lobby__preview">
          {selection.cameraOn ? (
            <video
              ref={videoRef}
              className="call-tile__video call-tile__video--self"
              autoPlay
              playsInline
              muted
            />
          ) : (
            <div className="call-tile__placeholder">
              <BemAvatar initials="Я" color="c5" size="xl" />
            </div>
          )}
          <div className="call-tile__bar">
            <span className="call-tile__name">Вы</span>
          </div>
        </div>

        <CardPanel title="Перед входом" subtitle="Проверьте камеру и микрофон">
          {permissionError ? <BannerInline variant="warn">{permissionError}</BannerInline> : null}
          <div className="call-lobby__form">
            <FormGrid columns={1}>
              <Field label="Камера">
                <Select
                  value={selection.videoDeviceId ?? ""}
                  onValueChange={onCamera}
                  disabled={cameras.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Камера" />
                  </SelectTrigger>
                  <SelectContent>
                    {cameras.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Микрофон">
                <Select
                  value={selection.audioDeviceId ?? ""}
                  onValueChange={onMicrophone}
                  disabled={microphones.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Микрофон" />
                  </SelectTrigger>
                  <SelectContent>
                    {microphones.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FormGrid>

            <div className="call-lobby__actions">
              <button
                type="button"
                className={cn("call-controls__btn", !selection.micOn && "call-controls__btn--off")}
                aria-pressed={selection.micOn}
                aria-label={selection.micOn ? "Выключить микрофон" : "Включить микрофон"}
                onClick={onToggleMicrophone}
              >
                {selection.micOn ? <Mic aria-hidden size={18} /> : <MicOff aria-hidden size={18} />}
                <span>Микрофон</span>
              </button>
              <button
                type="button"
                className={cn("call-controls__btn", !selection.cameraOn && "call-controls__btn--off")}
                aria-pressed={selection.cameraOn}
                aria-label={selection.cameraOn ? "Выключить камеру" : "Включить камеру"}
                onClick={onToggleCamera}
              >
                {selection.cameraOn ? (
                  <Camera aria-hidden size={18} />
                ) : (
                  <CameraOff aria-hidden size={18} />
                )}
                <span>Камера</span>
              </button>
              <Button variant="primary" onClick={onJoin}>
                Присоединиться
              </Button>
            </div>
          </div>
        </CardPanel>
      </div>
    </div>
  );
}
