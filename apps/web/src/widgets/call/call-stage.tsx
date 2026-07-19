"use client";

import {
  CircleDot,
  Mic,
  MicOff,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Sparkles,
  Video,
  VideoOff
} from "lucide-react";

import { cn } from "@/lib/cn";
import type {
  CallControlHandlers,
  CallLocalControls,
  CallStageView
} from "@/lib/call/types";

import { ParticipantTile } from "./participant-tile";

const PHASE_LABEL: Record<CallStageView["phase"], string> = {
  idle: "Ожидание",
  connecting: "Подключение…",
  connected: "В эфире",
  reconnecting: "Переподключение…",
  disconnected: "Звонок завершён",
  error: "Ошибка связи"
};

export type CallStageProps = {
  view: CallStageView;
  controls: CallLocalControls;
  handlers?: Partial<CallControlHandlers>;
  disabled?: boolean;
};

// Pure stage: participant grid + a control bar. The same component renders from a
// literal mock (Storybook twin) and from live engine state (runtime container).
export function CallStage({ view, controls, handlers, disabled }: CallStageProps) {
  const count = view.participants.length;
  const screenShareOn = controls.screenShareOn ?? false;
  return (
    <section className="call-stage" aria-label="Звонок команды">
      <header className="call-stage__head">
        <span className="call-stage__title">Звонок команды</span>
        <span className="call-stage__status">
          {/* Индикация записи видна всем участникам — не только тому, кто ей управляет. */}
          {controls.recordingOn ? (
            <span className="call-stage__recording" role="status">
              <span className="call-stage__recording-dot" aria-hidden /> Идёт запись
            </span>
          ) : null}
          <span className="call-stage__phase">{PHASE_LABEL[view.phase]}</span>
        </span>
      </header>

      <div
        className={cn("call-grid", count > 1 && "call-grid--multi")}
        data-count={count}
      >
        {view.participants.map((participant) => (
          <ParticipantTile key={participant.id} view={participant} />
        ))}
      </div>

      <footer className="call-controls">
        <button
          type="button"
          className={cn("call-controls__btn", !controls.micOn && "call-controls__btn--off")}
          aria-pressed={controls.micOn}
          aria-label={controls.micOn ? "Выключить микрофон" : "Включить микрофон"}
          disabled={disabled}
          title={disabled ? "Демо Storybook: подключение медиа отключено" : undefined}
          onClick={handlers?.onToggleMic}
        >
          {controls.micOn ? <Mic aria-hidden size={18} /> : <MicOff aria-hidden size={18} />}
          <span>Микрофон</span>
        </button>

        <button
          type="button"
          className={cn("call-controls__btn", !controls.cameraOn && "call-controls__btn--off")}
          aria-pressed={controls.cameraOn}
          aria-label={controls.cameraOn ? "Выключить камеру" : "Включить камеру"}
          disabled={disabled}
          title={disabled ? "Демо Storybook: подключение медиа отключено" : undefined}
          onClick={handlers?.onToggleCamera}
        >
          {controls.cameraOn ? <Video aria-hidden size={18} /> : <VideoOff aria-hidden size={18} />}
          <span>Камера</span>
        </button>

        <button
          type="button"
          className={cn("call-controls__btn", screenShareOn && "call-controls__btn--active")}
          aria-pressed={screenShareOn}
          aria-label={screenShareOn ? "Остановить демонстрацию экрана" : "Демонстрировать экран"}
          disabled={disabled}
          title={disabled ? "Демо Storybook: подключение медиа отключено" : undefined}
          onClick={handlers?.onToggleScreenShare}
        >
          {screenShareOn ? (
            <ScreenShareOff aria-hidden size={18} />
          ) : (
            <ScreenShare aria-hidden size={18} />
          )}
          <span>Экран</span>
        </button>

        {controls.backgroundSupported ? (
          <button
            type="button"
            className={cn(
              "call-controls__btn",
              (controls.background ?? "none") !== "none" && "call-controls__btn--active"
            )}
            aria-pressed={(controls.background ?? "none") !== "none"}
            aria-label="Сменить фон"
            disabled={disabled}
            title={disabled ? "Демо Storybook: подключение медиа отключено" : undefined}
            onClick={handlers?.onCycleBackground}
          >
            <Sparkles aria-hidden size={18} />
            <span>Фон</span>
          </button>
        ) : controls.backgroundUnavailableReason ? (
          /* Честный гейт (Н9): браузер умеет эффекты, но активы не развёрнуты в сборке —
             контрол задизейблен с причиной в тултипе вместо молчаливого no-op. */
          <button
            type="button"
            className="call-controls__btn call-controls__btn--off"
            aria-label="Сменить фон"
            aria-disabled="true"
            disabled
            title={controls.backgroundUnavailableReason}
          >
            <Sparkles aria-hidden size={18} />
            <span>Фон</span>
          </button>
        ) : null}

        {controls.recordingAvailable ? (
          /* Запись (Н11): рендерится только при работающем пути (egress настроен,
             manage-право, LiveKit-комната) — capability-гейт вместо мёртвой кнопки. */
          <button
            type="button"
            className={cn("call-controls__btn", controls.recordingOn && "call-controls__btn--active")}
            aria-pressed={controls.recordingOn ?? false}
            aria-label={controls.recordingOn ? "Остановить запись" : "Начать запись"}
            disabled={disabled || controls.recordingBusy}
            title={disabled ? "Демо Storybook: подключение медиа отключено" : undefined}
            onClick={handlers?.onToggleRecording}
          >
            <CircleDot aria-hidden size={18} />
            <span>Запись</span>
          </button>
        ) : null}

        <button
          type="button"
          className="call-controls__btn call-controls__btn--leave"
          aria-label="Завершить звонок"
          disabled={disabled}
          title={disabled ? "Демо Storybook: подключение медиа отключено" : undefined}
          onClick={handlers?.onLeave}
        >
          <PhoneOff aria-hidden size={18} />
          <span>Завершить</span>
        </button>
      </footer>
    </section>
  );
}
