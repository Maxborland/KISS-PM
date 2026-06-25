"use client";

import { MicOff, MonitorUp } from "lucide-react";
import { useEffect, useRef } from "react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { cn } from "@/lib/cn";
import type { ParticipantTileView, QualityLevel } from "@/lib/call/types";

const QUALITY_LABEL: Record<QualityLevel, string> = {
  excellent: "Отличная связь",
  good: "Хорошая связь",
  poor: "Слабая связь",
  lost: "Связь потеряна",
  unknown: "Связь неизвестна"
};

function QualityBars({ quality }: { quality: QualityLevel }) {
  return (
    <span
      className={cn("call-quality", `call-quality--${quality}`)}
      role="img"
      aria-label={QUALITY_LABEL[quality]}
    >
      <span className="call-quality__bar" />
      <span className="call-quality__bar" />
      <span className="call-quality__bar" />
    </span>
  );
}

// Pure presentational tile. Renders a live <video> when the engine supplies an
// attach callback (camera or shared screen), otherwise the avatar fallback.
export function ParticipantTile({ view }: { view: ParticipantTileView }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attachRef = useRef(view.attachVideo);
  attachRef.current = view.attachVideo;
  const showVideo = Boolean(view.attachVideo);
  const videoKey = view.videoTrackId;

  useEffect(() => {
    const element = videoRef.current;
    const attach = attachRef.current;
    if (!attach || !element || !showVideo) return;
    attach(element);
    // Re-attach only when the underlying track changes (videoKey), NOT on every roster
    // refresh (active-speaker / quality events) — otherwise the video flickers/restarts.
    return () => attach(null);
  }, [videoKey, showVideo]);

  return (
    <div className={cn("call-tile", view.speaking && "call-tile--speaking")}>
      {showVideo ? (
        <video
          ref={videoRef}
          className={cn(
            "call-tile__video",
            view.self && !view.sharingScreen && "call-tile__video--self"
          )}
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
        {view.sharingScreen ? (
          <span className="call-tile__share" aria-label="Демонстрирует экран">
            <MonitorUp aria-hidden size={13} />
          </span>
        ) : null}
        {view.quality ? <QualityBars quality={view.quality} /> : null}
      </div>
    </div>
  );
}
