"use client";

import { MicOff } from "lucide-react";
import { useEffect, useRef } from "react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { cn } from "@/lib/cn";
import type { ParticipantTileView } from "@/lib/call/types";

// Pure presentational tile: renders a live <video> when the engine supplies an
// attach callback and the camera is on, otherwise the avatar fallback. Imports no
// media SDK — the SDK lives only under lib/call/*.
export function ParticipantTile({ view }: { view: ParticipantTileView }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const showVideo = view.camera === "on" && Boolean(view.attachVideo);
  const attachVideo = view.attachVideo;

  useEffect(() => {
    const element = videoRef.current;
    if (!attachVideo || !element || !showVideo) return;
    attachVideo(element);
    return () => attachVideo(null);
  }, [attachVideo, showVideo]);

  return (
    <div className={cn("call-tile", view.speaking && "call-tile--speaking")}>
      {showVideo ? (
        <video
          ref={videoRef}
          className={cn("call-tile__video", view.self && "call-tile__video--self")}
          autoPlay
          playsInline
          muted={view.self}
        />
      ) : (
        <div className="call-tile__placeholder">
          <BemAvatar initials={view.initials} color={view.color} size="lg" />
        </div>
      )}
      <div className="call-tile__bar">
        {view.mic === "off" ? (
          <span className="call-tile__muted" aria-label="Микрофон выключен">
            <MicOff aria-hidden size={14} />
          </span>
        ) : null}
        <span className="call-tile__name">{view.name}</span>
      </div>
    </div>
  );
}
