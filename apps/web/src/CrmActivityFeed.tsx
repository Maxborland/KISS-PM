import type { CrmActivity, CrmSystemEvent } from "./api";
import { CheckCircle2, MessageCircle, Paperclip, SquareCheckBig } from "lucide-react";
import {
  groupCrmFeedItemsByDay,
  type CrmFeedItem
} from "./crmActivity";
import type { WorkspaceData } from "./workspaceData";
import { StatusPill } from "./components/workspace-ui";
import { getAuditActionLabel } from "./workspaceDashboard";
import { formatDate } from "./workspaceViewHelpers";

export function CrmFeedView(props: {
  data: WorkspaceData;
  items: CrmFeedItem[];
}) {
  if (props.items.length === 0) {
    return <p className="empty-state compact">В ленте сделки пока нет событий.</p>;
  }

  return (
    <div className="activity-list">
      {groupCrmFeedItemsByDay(props.items).map((group) => (
        <section className="activity-day-group" key={group.dateKey}>
          <h3>{group.label}</h3>
          <div className="activity-day-items">
            {group.items.map((item) =>
              item.kind === "activity" ? (
                <CrmActivityRow
                  activity={item.activity}
                  data={props.data}
                  key={`activity-${item.activity.id}`}
                />
              ) : (
                <CrmSystemEventRow
                  data={props.data}
                  event={item.event}
                  key={`system-${item.event.id}`}
                />
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

export function CrmActivityRow(props: {
  activity: CrmActivity;
  data: WorkspaceData;
}) {
  const isTask = props.activity.type === "task";
  const isFile = props.activity.type === "file";
  const Icon = isTask ? SquareCheckBig : isFile ? Paperclip : MessageCircle;

  return (
    <article className={`activity-row ${isTask ? "task-row" : "comment-row"}`}>
      <time dateTime={props.activity.createdAt}>{formatActivityTime(props.activity.createdAt)}</time>
      <span className="activity-row-marker">
        <Icon aria-hidden="true" size={15} />
      </span>
      <div className="activity-row-content">
        <strong>
          {isTask ? props.activity.title : isFile ? props.activity.title : "Комментарий"}
        </strong>
        <p>{props.activity.body || (isTask ? "Без описания" : props.activity.fileUrl ?? "")}</p>
        <small>
          {getWorkspaceUserName(props.data, props.activity.authorUserId)} ·{" "}
          {formatDate(props.activity.createdAt)}
        </small>
      </div>
      {isTask ? (
        <StatusPill
          label={props.activity.status === "done" ? "Выполнена" : "К выполнению"}
          tone={props.activity.status === "done" ? "success" : "muted"}
        />
      ) : null}
    </article>
  );
}

export function CrmSystemEventRow(props: {
  data: WorkspaceData;
  event: CrmSystemEvent;
}) {
  return (
    <article className="activity-row system-row">
      <time dateTime={props.event.createdAt}>{formatActivityTime(props.event.createdAt)}</time>
      <span className="activity-row-marker">
        <CheckCircle2 aria-hidden="true" size={15} />
      </span>
      <div className="activity-row-content">
        <strong>{getAuditActionLabel(props.event.actionType)}</strong>
        <p>{getWorkspaceUserName(props.data, props.event.actorUserId)}</p>
        <small>{formatDate(props.event.createdAt)}</small>
      </div>
    </article>
  );
}

export function getWorkspaceUserName(data: WorkspaceData, userId: string): string {
  return data.users.find((user) => user.id === userId)?.name ?? `Пользователь ${userId}`;
}

function formatActivityTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "UTC"
  }).format(new Date(value));
}
