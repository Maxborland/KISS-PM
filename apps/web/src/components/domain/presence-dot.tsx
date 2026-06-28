import { cn } from "@/lib/cn";

export type PresenceStatus = "online" | "away" | "offline";

const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  online: "В сети",
  away: "Отошёл",
  offline: "Не в сети"
};

export function PresenceDot({ status }: { status: PresenceStatus }) {
  return (
    <span
      className={cn("presence-dot", `presence-dot--${status}`)}
      role="img"
      aria-label={PRESENCE_LABEL[status]}
    />
  );
}
