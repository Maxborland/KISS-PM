import type { CallStageView } from "@/lib/call/types";

// Static literal fixture for the Storybook twin (no engine, no SDK, no fetch).
export const CALL_STAGE_MOCK: CallStageView = {
  phase: "connected",
  participants: [
    { id: "u-anna", name: "Анна Кузнецова", initials: "АК", color: "c1", camera: "off", mic: "on", speaking: true },
    { id: "u-boris", name: "Борис Орлов", initials: "БО", color: "c3", camera: "off", mic: "off" },
    { id: "u-self", name: "Вы", initials: "Я", color: "c5", camera: "off", mic: "on", self: true }
  ]
};
