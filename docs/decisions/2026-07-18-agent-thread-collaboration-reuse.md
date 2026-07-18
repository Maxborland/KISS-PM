# ADR: Персистентный тред агента поверх collaboration-модели

Дата: 2026-07-18.

## Статус

Принято.

## Контекст

Агент «Генри Гантт» ведёт с пользователем диалог: запрос → трейс хода → предложение →
исход применения. Эта история должна переживать reload, быть видимой во второй вкладке
(realtime) и попадать в контекст LLM как память диалога. Нужно было выбрать место хранения:
отдельная agent-подсистема (своя таблица/API) или переиспользование существующей
collaboration-модели (conversations + discussion messages), у которой уже есть
персистентность, membership-доступ, read state, пагинация и realtime-канал `message.created`.

## Решение

Отдельной agent-подсистемы хранения нет намеренно. Тред агента — это обычная conversation
поверх существующей collaboration-модели (`apps/api/src/agent/agentThread.ts`):

- У пользователя один приватный тред: `entityType = "agent"`, `entityId = userId`,
  `conversationType = "agent"`, детерминированный id `agent-thread-<userId>`.
  Create-or-get идемпотентен по `(tenantId, id)` через `ensureConversation`.
- Доступ — по членству (как у любых бесед): в тред добавляется только владелец.
- Server-only writer: клиентская запись в conversation типа `agent` запрещена на уровне
  collaboration-роутов (403 `agent_conversation_readonly`). Единственный писатель
  agent-семантики — модуль `agentThread`, вызываемый из `/propose` и `/execute`.
- Реплики агента пишутся от имени владельца треда (`authorUserId = userId`); роль хода —
  в `metadata.agent` (типизированный `AgentTurnMetadata`): `user`-реплика, ответ агента
  (со снимком предложения или `kind: "error"`), `kind: "result"` с per-action outcomes
  (`auditEventId`, `planningAuditEventId`, `planVersion`, `projectId`, `correlationId`)
  и `role: "trace"` — завершённый CoT-трейс хода (реальные SSE-шаги).
- Тред — история решений, не дамп payload'ов: текст снимка ≤ 500 символов, body ≤ 4000,
  ≤ 20 действий в снимке, ≤ 50 шагов трейса по ≤ 200 символов. Полный payload действий
  не персистится — источник правды для применения остаётся в live-контракте
  propose/execute, а не в истории.
- Чтение — существующим `GET /conversations/:id/messages` (гидрация с пагинацией,
  `AGENT_HISTORY_PAGE_LIMIT = 30`); каждый персистентный ход эмитится в канал беседы тем же
  `message.created`, что и обычные беседы, — вторая вкладка видит его через
  `useWorkspaceRealtime`, optimistic-сообщения клиента дедуплицируются через
  `adoptServerIds`.
- История для LLM собирается из персистентного треда (`historyFromThreadMessages`):
  user/agent-ходы, error-квитанции и трейс в контекст не попадают. Переданный клиентом
  `threadId` валидируется владением (fail-closed 403 `agent_thread_forbidden`).
- Деградация честная: без collaboration-персистентности (`agentThreadConfigured` = false)
  тред просто не пишется, `messageIds` в ответе нет; fake persistence с клиента запрещена.

## Рассмотренные альтернативы

- **Отдельная таблица `agent_messages` + свой API.** Дублирует уже существующие механизмы:
  membership-доступ, read state, пагинацию, realtime-доставку, сериализацию. Дал бы второй
  канал доставки сообщений и второй набор тестов доступа без новой пользовательской ценности.
- **Хранение истории на клиенте (UI-стейт / localStorage).** Не переживает смену устройства,
  не даёт realtime во второй вкладке и позволяет клиенту фальсифицировать историю —
  противоречит принципу «квитанции ссылаются только на реальные записи».
- **Полная персистенция payload'ов действий в истории.** Превращает тред в источник правды
  для применения и создаёт риск применения устаревших payload'ов; отвергнуто в пользу капов
  и явного правила «источник правды — live-контракт propose/execute».

## Последствия

- Realtime, пагинация, read state и права доступа достаются треду агента бесплатно и не
  могут разъехаться с обычными беседами.
- Ограничение: схема хода выражается через `metadata` discussion message, а не через
  собственные колонки; типизация держится конвенцией `AgentTurnMetadata` и капами.
- Снимок предложения в истории forward-safe: неизвестные будущие поля действий в него
  не попадают by design; для «применить из истории» нужен новый propose.
- Если агенту понадобятся несколько тредов на пользователя или общие (командные) треды,
  модель расширяется новыми conversation-записями без миграции хранилища; принципиально
  другая схема хранения потребует отдельного ADR.

## Acceptance evidence

- Guarded-роут `GET /api/workspace/agent/thread` — create-or-get, 501 без
  collaboration-персистентности.
- Попытка клиентской записи в conversation типа `agent` возвращает 403
  `agent_conversation_readonly` (collaborationRoutes, db-тесты).
- Ходы propose/execute персистятся с `metadata.agent` и эмитятся `message.created`;
  чужой `threadId` в propose — 403 `agent_thread_forbidden`.
