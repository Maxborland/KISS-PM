import { AvatarGroup, type AvatarGroupItem } from "@/components/ui/avatar-group";
import { cn } from "@/lib/cn";

export type Participant = {
  id: string;
  name: string;
  initials: string;
  role?: string;
};

export type ParticipantListProps = {
  participants: Participant[];
  maxAvatars?: number;
  className?: string;
};

/** Список участников с AvatarGroup. */
export function ParticipantList({ participants, maxAvatars = 4, className }: ParticipantListProps) {
  const avatarItems: AvatarGroupItem[] = participants.map((p) => ({
    id: p.id,
    initials: p.initials,
    title: p.name
  }));

  return (
    <div className={cn("participant-list", className)} role="list" aria-label="Участники">
      <AvatarGroup items={avatarItems} max={maxAvatars} />
      {participants.map((p) => (
        <div key={p.id} className="participant-list__row" role="listitem">
          <span className="participant-list__name">{p.name}</span>
          {p.role ? <span className="participant-list__role">{p.role}</span> : null}
        </div>
      ))}
    </div>
  );
}
