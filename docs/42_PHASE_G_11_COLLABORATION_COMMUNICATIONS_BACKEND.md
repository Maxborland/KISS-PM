# 42. Phase G / Phase 11: Collaboration & Communications backend

## Статус

Phase G начинается после Phase 10 production readiness. Это backend-only фаза: UI, мобильные клиенты, собственный WebRTC/video stack и visual chat surface не входят.

## Product intent

KISS PM должен быть не только planning/control engine, но и рабочим контекстом команды. Коммуникации нужны не как отдельный мессенджер, а как слой, который связывает проектные решения, задачи, KPI signals, corrective actions, встречи, файлы и audit.

Пользовательская ценность:

- PM видит обсуждения и решения рядом с проектом/задачей/opportunity;
- участник получает упоминания, назначения и изменения без ручной проверки всех экранов;
- meeting notes и action items не теряются после звонка;
- self-hosted tenant может использовать внешние video providers без передачи business-state в них.

## Scope

### Chats and discussions

- Project conversation.
- Task discussion.
- CRM/opportunity discussion.
- Thread-safe messages with author, created/edited/archive state.
- `@user` mentions.
- Read/unread state per user and conversation.
- Pinned messages.
- Attachments through existing `EntityAttachment` / storage layer.
- Entity links to tasks, projects, KPI signals, corrective actions and control actions.

### Notifications

- Mention notifications.
- Assignment/change notifications.
- Deadline/risk/control-signal notifications.
- Digest-ready notification feed.
- Notification preferences per user.
- Delivery v1 is persisted in-app notification state; push/email/websocket fan-out is future adapter scope.

### Meetings and calls

- Meeting entity scoped to project, task or opportunity.
- Agenda, participants, scheduled start/finish.
- External meeting links: `zoom`, `teams`, `google_meet`, `manual_link`, `other`.
- Meeting notes.
- Recordings/files via attachment layer.
- Decisions and action items after meeting.

### Video

- v1 does not implement proprietary WebRTC.
- v1 stores and validates external provider references only.
- v2 may add self-hosted Jitsi/WebRTC integration if product requirements justify it.

## Domain model

### Conversation

Tenant-scoped communication container.

Fields:

- `id`, `tenantId`;
- `entityType`: `project | task | opportunity`;
- `entityId`;
- `conversationType`: `default | meeting_followup`;
- `title`;
- `createdByUserId`, `createdAt`, `archivedAt`.

Invariant: v1 has one default conversation per `(tenantId, entityType, entityId)`.

### DiscussionMessage

Fields:

- `id`, `tenantId`, `conversationId`;
- `authorUserId`;
- `body`;
- `metadata`;
- `createdAt`, `editedAt`, `archivedAt`;
- `pinnedAt`, `pinnedByUserId`.

Body is plain text or constrained rich-text JSON in v1. No arbitrary HTML.

### MessageMention

Fields:

- `tenantId`, `messageId`, `mentionedUserId`, `createdAt`.

Mentions create notification candidates only for users allowed to read the parent entity.

### ConversationReadState

Fields:

- `tenantId`, `conversationId`, `userId`;
- `lastReadMessageId`, `lastReadAt`;
- `unreadCount`.

Unread state is derived/updated by application services, not by frontend trust.

### UserNotification

Fields:

- `id`, `tenantId`, `userId`;
- `notificationType`: `mention | assignment_changed | deadline_risk | control_signal | meeting_invite | meeting_action_item`;
- `sourceEntityType`, `sourceEntityId`;
- `title`, `body`, `route`;
- `createdAt`, `readAt`, `archivedAt`.

Unread notifications omit entities the user cannot read. Permission loss after creation must hide or archive unreadable notifications in read models.

### NotificationPreference

Fields:

- `tenantId`, `userId`;
- `channel`: `in_app | email | digest`;
- `notificationType`;
- `enabled`;
- `digestFrequency`: `none | daily | weekly`.

Only `in_app` is active in v1. Other channels are preference contracts for future adapters.

### Meeting

Fields:

- `id`, `tenantId`;
- `entityType`: `project | task | opportunity`;
- `entityId`;
- `title`, `agenda`;
- `scheduledStart`, `scheduledFinish`;
- `status`: `scheduled | completed | cancelled`;
- `createdByUserId`, `createdAt`, `archivedAt`.

### MeetingParticipant

Fields:

- `tenantId`, `meetingId`, `userId`;
- `role`: `organizer | required | optional`;
- `response`: `pending | accepted | declined`;
- `createdAt`.

### MeetingExternalLink

Fields:

- `id`, `tenantId`, `meetingId`;
- `provider`: `zoom | teams | google_meet | manual_link | other`;
- `url`, `title`;
- `createdByUserId`, `createdAt`, `archivedAt`.

URL validation reuses external-reference safety rules: no server-side fetch, no credentials in URL, no `javascript:`/`data:`/relative URLs.

### MeetingNote

Fields:

- `id`, `tenantId`, `meetingId`;
- `authorUserId`, `body`;
- `createdAt`, `editedAt`, `archivedAt`.

### MeetingActionItem

Fields:

- `id`, `tenantId`, `meetingId`;
- `title`, `ownerUserId`, `dueDate`;
- `targetEntityType`: `task | corrective_action | project | opportunity`;
- `targetEntityId`;
- `status`: `open | done | cancelled`;
- `createdByUserId`, `createdAt`, `archivedAt`.

Action items may create governed task/corrective-action candidates, but they do not mutate planning/control state directly.

## API surface v1

- `GET /api/workspace/conversations?entityType=&entityId=`
- `GET /api/workspace/conversations/:conversationId/messages?cursor=&limit=`
- `POST /api/workspace/conversations/:conversationId/messages`
- `PATCH /api/workspace/conversations/:conversationId/messages/:messageId`
- `POST /api/workspace/conversations/:conversationId/messages/:messageId/pin`
- `DELETE /api/workspace/conversations/:conversationId/messages/:messageId`
- `POST /api/workspace/conversations/:conversationId/read-state`
- `GET /api/workspace/notifications?status=&limit=`
- `POST /api/workspace/notifications/:notificationId/read`
- `GET /api/workspace/notification-preferences`
- `PUT /api/workspace/notification-preferences`
- `GET /api/workspace/meetings?entityType=&entityId=`
- `POST /api/workspace/meetings`
- `PATCH /api/workspace/meetings/:meetingId`
- `POST /api/workspace/meetings/:meetingId/external-links`
- `POST /api/workspace/meetings/:meetingId/notes`
- `POST /api/workspace/meetings/:meetingId/action-items`

## Permissions

Read permission is inherited from the scoped entity:

- project conversation/meeting: project read;
- task discussion/meeting: project read or task owner/requester/participant;
- opportunity discussion/meeting: opportunity read.

Write/manage:

- messages: entity read plus active workspace user;
- edit/delete own message: author or entity manager;
- pin/unpin: entity manager;
- meetings: entity manage;
- meeting notes: meeting participant or entity manager;
- meeting action items: entity manage, or participant when configured later.

Private channels are out-of-scope until a concrete tenant scenario exists.

## Audit

Required audit actions:

- `collaboration.message_created`;
- `collaboration.message_edited`;
- `collaboration.message_removed`;
- `collaboration.message_pinned`;
- `collaboration.meeting_created`;
- `collaboration.meeting_updated`;
- `collaboration.meeting_completed`;
- `collaboration.external_meeting_link_added`;
- `collaboration.meeting_note_created`;
- `collaboration.meeting_action_item_created`;
- `notification.preference_updated`;
- denial actions for write/manage attempts.

Audit stores safe metadata only: entity, ids, provider type, participant ids and action status. It never stores provider credentials, raw private URLs with credentials, storage keys, local paths or binary object internals.

## Architecture boundaries

- Domain package owns pure types, validation and notification derivation rules.
- API/application services own permission checks, mention expansion, read-state updates and audit writes.
- Persistence owns tenant-scoped tables and repository methods.
- Storage remains the source for binary files and recordings.
- External meeting providers are metadata references in v1, not connector sync jobs.
- Realtime fan-out may later use planning event infrastructure patterns, but persisted DB state remains the source of truth.

## Non-scope

- Frontend chat UI.
- Mobile push.
- Email sending.
- Server-side URL fetch for meeting links.
- Proprietary WebRTC/video calls.
- Full-text indexing of message body.
- Private channels without an explicit product scenario.
- AI meeting summaries.

## Acceptance criteria

1. A user who can read a project can open its conversation, create a message, mention a readable tenant user and see unread state update.
2. A user without access to the parent entity cannot read messages, meetings or notifications for that entity.
3. Mentions create in-app notifications only for users allowed to read the parent entity.
4. Project/task/opportunity meetings can be created with participants, safe external link, notes and action items.
5. Recordings/files are attached through existing attachment APIs rather than new binary storage.
6. All write/manage flows check permissions and write audit.
7. External meeting links reject unsafe URLs and are never server-fetched.
8. Tenant isolation is enforced in schema, repository and API tests.

## Test plan

- Unit:
  - mention parser and permission-filtered notification derivation;
  - safe meeting URL validation;
  - notification preference merge/validation.
- DB/integration:
  - conversation uniqueness per entity;
  - tenant isolation;
  - unread/read state transitions;
  - message archive/pin behavior;
  - meeting participant/action-item persistence.
- API:
  - project/task/opportunity conversation read/write;
  - permission denied paths;
  - notification read/preference updates;
  - meeting lifecycle with external link, note and action item;
  - audit events for successful and denied mutations.
- Regression:
  - existing planning, KPI/control, storage/search, capacity, closure and audit tests keep passing.
