"use client";

import { Camera, Mic, Monitor } from "lucide-react";

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
import { UI_ONLY_PREVIEW_BANNER_TEXT } from "@/lib/featureFlags";
import { CallStage, ParticipantTile } from "@/widgets/call";
import { CALL_STAGE_MOCK } from "@/widgets/call/call-stage.mocks";
import { ConversationView } from "@/widgets/chat";
import { CHAT_CONVERSATION_MOCK } from "@/widgets/chat/chat-widget.mocks";

const DEMO_TITLE = "Демо Storybook: подключение медиа отключено";

function PreviewBanner() {
  return <BannerInline variant="warn">{UI_ONLY_PREVIEW_BANNER_TEXT}</BannerInline>;
}

export function CallActiveBlock() {
  return (
    <div className="call-screen">
      <PreviewBanner />
      <CallStage view={CALL_STAGE_MOCK} controls={{ micOn: true, cameraOn: false }} disabled />
    </div>
  );
}

export function CallReconnectingBlock() {
  return (
    <div className="call-screen">
      <PreviewBanner />
      <CallStage
        view={{ ...CALL_STAGE_MOCK, phase: "reconnecting" }}
        controls={{ micOn: false, cameraOn: false }}
        disabled
      />
    </div>
  );
}

export function CallLobbyBlock() {
  return (
    <div className="call-screen">
      <PreviewBanner />
      <div className="call-lobby">
        <div className="call-tile call-lobby__preview">
          <div className="call-tile__placeholder">
            <BemAvatar initials="Я" color="c5" size="xl" />
          </div>
          <div className="call-tile__bar">
            <span className="call-tile__name">Вы · камера выключена</span>
          </div>
        </div>
        <CardPanel title="Перед входом" subtitle="Проверьте камеру и микрофон">
          <div className="call-lobby__form">
            <FormGrid columns={1}>
              <Field label="Камера">
                <Select disabled defaultValue="cam">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cam">Встроенная камера</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Микрофон">
                <Select disabled defaultValue="mic">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mic">Микрофон ноутбука</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FormGrid>
            <div className="call-lobby__actions">
              <Button variant="secondary" size="sm" disabled title={DEMO_TITLE}>
                <Mic className="size-4" aria-hidden />
                Микрофон
              </Button>
              <Button variant="secondary" size="sm" disabled title={DEMO_TITLE}>
                <Camera className="size-4" aria-hidden />
                Камера
              </Button>
              <Button variant="primary" size="sm" disabled title={DEMO_TITLE}>
                Присоединиться
              </Button>
            </div>
          </div>
        </CardPanel>
      </div>
    </div>
  );
}

export function CallScreenShareBlock() {
  return (
    <div className="call-screen">
      <PreviewBanner />
      <div className="call-share">
        <div className="call-share__stage">
          <div className="call-share__screen">
            <Monitor aria-hidden size={28} />
            <span>Демонстрация экрана — Анна Кузнецова</span>
          </div>
        </div>
        <div className="call-share__strip">
          {CALL_STAGE_MOCK.participants.map((participant) => (
            <ParticipantTile key={participant.id} view={participant} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CallInChatBlock() {
  return (
    <div className="call-screen">
      <PreviewBanner />
      <div className="call-inchat">
        <div className="call-inchat__stage">
          <CallStage view={CALL_STAGE_MOCK} controls={{ micOn: true, cameraOn: false }} disabled />
        </div>
        <aside className="call-inchat__panel">
          <ConversationView view={{ ...CHAT_CONVERSATION_MOCK, title: "Чат звонка", subtitle: "Сообщения во время встречи" }} />
        </aside>
      </div>
    </div>
  );
}

export function CallDeviceSettingsBlock() {
  return (
    <div className="call-screen">
      <PreviewBanner />
      <CardPanel title="Настройки устройств" subtitle="Камера, микрофон и виртуальный фон">
        <FormGrid columns={1}>
          <Field label="Камера">
            <Select disabled defaultValue="cam">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cam">Встроенная камера</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Микрофон">
            <Select disabled defaultValue="mic">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mic">Микрофон ноутбука</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Динамики">
            <Select disabled defaultValue="spk">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spk">Системные динамики</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </FormGrid>
        <div className="call-devices__bg">
          <span className="call-devices__bg-label">Виртуальный фон</span>
          <div className="call-bg-row">
            <button type="button" className="call-bg-thumb call-bg-thumb--active" disabled title={DEMO_TITLE}>
              Без фона
            </button>
            <button type="button" className="call-bg-thumb" disabled title={DEMO_TITLE}>
              Размытие
            </button>
            <button type="button" className="call-bg-thumb" disabled title={DEMO_TITLE}>
              Офис
            </button>
          </div>
        </div>
      </CardPanel>
    </div>
  );
}
