# Full Evaluation reconciliation — 2026-07-07

Цель файла: зафиксировать текущую правду после подтягивания `origin/master` и текущего hardening-batch, чтобы не путать старый audit backlog с реально открытыми багами.

## Вывод

Старый `docs/qa/full-eval/phase5-outcome.md` начинался как blocked-handoff: 74 бага, 14 кластеров, полный clean-pass не достигнут.

После этого в master уже вошёл большой UI/UX fix-pass `docs/qa/full-eval/uiux-loop-2026-07-05/report.md`, где закрыты P0, P1, P2 и P3. Поэтому старые bug-id из `bugs/*.md` нельзя автоматически считать открытыми. Их надо читать через статус master-fix-pass и свежие проверки.

Текущий рабочий batch после merge master дополнительно закрыл найденные пересечения:

- admin RBAC/read-only role UX: ограниченный пользователь больше не получает сломанный admin surface и лишние write actions;
- dev-loopback trusted mutation origins: logout с web/dev-порта на API/dev-порт больше не падает `403 same_origin_action_required`;
- project overview live status ids: KPI/ключевые задачи используют `task-status-*`, а не только мок-строки `done`/`in_progress`;
- project overview actions: disabled `demoAction` заменены на реальные ссылки на существующие вкладки;
- profile permission-aware edit state: роль без `profile.update`/`workspace.theme.manage` больше не видит fake-edit controls на `/profile`; `BUG-SHELL-11` закрыт текущей веткой свежим browser evidence.

## Что считать закрытым master'ом

По `uiux-loop-2026-07-05/report.md`:

- P0: живой project/comms scope, реальные project headers, CRM date save, not-found вместо подмены первой сущностью, глобальный поиск, provider-status, честные security policies.
- P1: toast/error/confirm паттерны, permission-aware nav, 403 UX, CRUD closure, my-work scope, `/settings`, глобальная тема.
- P2/P3: prototype-gate hygiene, display-name вместо технических id, empty/onboarding states, role permission labels/audit UX, favicon/title/pluralization/404 polish.

Следствие: старые записи вроде `BUG-002`, `BUG-SHELL-02`, `BUG-PROJ-06/07/08`, `G2-01`, `G3-01`, `G4-01`, `G5-01..03`, `G6-01` уже не должны всплывать как “следующие баги” без свежей перепроверки на текущем master.

## Что не является закрытым clean-pass

Остались ограничения, явно названные самим full-eval:

- валидный happy-path сброса пароля не проверялся end-to-end через реальный email provider;
- реальные LLM-предложения агента и живой SSE не проверены, потому что стенд был на mock/provider-degraded режиме;
- LiveKit/Jitsi/media-provider поведение как настоящий звонок не проверялось, только degraded/provider-status;
- drag-and-drop канбанов проверялся ограниченно;
- полный browser traversal после всех master-fixes не был заново прогнан как одна свежая матрица `role × route × action`.

Это не обязательно “открытые продуктовые баги”, но это не засчитанный clean-pass Full Product Evaluation.

## Ошибка процесса

После merge master надо было сразу сделать этот reconciliation-pass и обновить матрицу статусов. Вместо этого были смешаны:

- старые баги из initial full-eval;
- исправления, уже попавшие в master;
- свежие пересечения текущей ветки;
- реальные unverified зоны.

Из-за этого следующий backlog был назван неточно. Корректный следующий шаг перед любыми новыми фиксами — свежая сверка матрицы, а не выбор старого bug-id из `bugs/*.md`.

## Следующий безопасный шаг

Перед продолжением фиксов:

1. Сформировать machine-readable reconciliation matrix: `old finding id × current source × master status × current branch status × fresh evidence × final status`.
2. Прогнать свежие targeted smoke/e2e по тем зонам, которые документы называют ограничениями: auth email reset, agent provider, media provider, duplicate/race/idempotency write-flows, browser traversal по ролям.
3. Только после этого брать следующий fix-batch из строк со статусом `confirmed-open`.
