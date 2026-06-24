"use client";

import { BannerInline } from "@/components/ui/banner-inline";
import { useCallEngine } from "@/lib/call/call-engine";
import { CallStage } from "@/widgets/call";

// Live container: mounts the engine and feeds its view-model into the SAME pure
// CallStage the Storybook twin renders. Loaded via next/dynamic({ ssr: false }).
export function CallRuntimeView({ roomId }: { roomId: string }) {
  const { stage, controls, handlers, error } = useCallEngine(roomId);

  return (
    <div className="call-screen">
      {error ? (
        <BannerInline variant="danger">Не удалось подключиться к звонку</BannerInline>
      ) : null}
      <CallStage view={stage} controls={controls} handlers={handlers} />
    </div>
  );
}
