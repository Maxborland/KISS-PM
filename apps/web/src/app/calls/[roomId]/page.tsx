"use client";

import dynamic from "next/dynamic";
import { use } from "react";

// Thin client route. The call container is loaded with ssr:false so livekit-client
// (browser/WebRTC/WASM) never reaches the server bundle.
const CallRuntimeView = dynamic(
  () => import("@/views/screens/call-runtime-view").then((module) => module.CallRuntimeView),
  { ssr: false }
);

export default function CallRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  return <CallRuntimeView roomId={roomId} />;
}
