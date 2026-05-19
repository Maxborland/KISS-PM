import type { OpportunityActivity, OpportunitySystemEvent } from "./api";
import type { OpportunityFeedItem } from "./opportunityActivity";
import type { WorkspaceData } from "./workspaceData";
import { StatusPill } from "./components/workspace-ui";
import { getAuditActionLabel } from "./workspaceDashboard";
import { formatDate } from "./workspaceViewHelpers";

export function OpportunityFeedView(props: {
  data: WorkspaceData;
  items: OpportunityFeedItem[];
}) {
  if (props.items.length === 0) {
    return <p className="empty-state compact">В ленте сделки пока нет событий.</p>;
  }

  return (
    <div className="activity-list">
      {props.items.map((item) =>
        item.kind === "activity" ? (
          <OpportunityActivityRow
            activity={item.activity}
            data={props.data}
            key={`activity-${item.activity.id}`}
          />
        ) : (
          <OpportunitySystemEventRow
            data={props.data}
            event={item.event}
            key={`system-${item.event.id}`}
          />
        )
      )}
    </div>
  );
}

export function OpportunityActivityRow(props: {
  activity: OpportunityActivity;
  data: WorkspaceData;
}) {
  const isTask = props.activity.type === "task";

  return (
    <article className="activity-row">
      <div>
        <strong>{isTask ? props.activity.title : "Комментарий"}</strong>
        <p>{props.activity.body || (isTask ? "Без описания" : "")}</p>
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

export function OpportunitySystemEventRow(props: {
  data: WorkspaceData;
  event: OpportunitySystemEvent;
}) {
  return (
    <article className="activity-row system-row">
      <div>
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
