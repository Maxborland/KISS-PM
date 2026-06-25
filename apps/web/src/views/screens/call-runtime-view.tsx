"use client";

import { BannerInline } from "@/components/ui/banner-inline";
import { useCallEngine } from "@/lib/call/call-engine";
import { CallStage } from "@/widgets/call";
import { ConversationView, MessageComposer } from "@/widgets/chat";

// Live container: mounts the engine and feeds its view-model into the SAME pure
// CallStage / chat widgets the Storybook twins render. Loaded via dynamic ssr:false.
export function CallRuntimeView({ roomId }: { roomId: string }) {
  const { stage, controls, handlers, error, chat, sendChat } = useCallEngine(roomId);

  return (
    <div className="call-screen">
      {error ? (
        <BannerInline variant="danger">Не удалось подключиться к звонку</BannerInline>
      ) : null}
      <div className="call-inchat">
        <div className="call-inchat__stage">
          <CallStage view={stage} controls={controls} handlers={handlers} />
        </div>
        <aside className="call-inchat__panel">
          <ConversationView
            view={{ title: "Чат звонка", subtitle: "Сообщения во время встречи", messages: chat }}
          />
          <MessageComposer onSend={sendChat} showExtras={false} />
        </aside>
      </div>
    </div>
  );
}
