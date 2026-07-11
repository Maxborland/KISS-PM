# LiveKit reconnect evidence audit

Дата аудита: 2026-07-10
Режим: скептический read-only аудит; изменён только этот отчёт.
Вердикт по текущему evidence: **REJECT**.

## Основание вердикта

Текущий незатреканный набор `docs/qa/full-eval/evidence/browser-media-livekit-reconnect-2026-07-09/` содержит ровно один файл: `risk-media-livekit-reconnect-2026-07-09.json` (6206 байт). В нём:

- есть только фаза `setup`;
- создание комнаты и запуск сессии вернули `201`, API readback вернул `200`;
- комната и сессия остались `active`;
- зафиксированы только `room_created`, `session_started`, `join_token_issued`;
- `screenshots=[]`, `livekitLogs.lines=[]`, `verdict.passed=[]`;
- собственный verdict артефакта: `failed_or_blocked`;
- browser join завершился таймаутом до состояния active из-за ошибки WebSocket signal connection.

Это доказывает лишь частичный control-plane setup и не доказывает даже один успешный LiveKit join. Нет двух одновременно подключённых пользователей, исходного двунаправленного media baseline, состояния offline, возврата online, `livekit` pause/unpause, переходов UI, восстановления media или непрерывности той же сессии. Поэтому результат не может быть повышен до `inconclusive-pass`: это явный **REJECT текущего evidence**.

## Поведение call engine

CodeGraph был использован до чтения исходников. Значимые места:

- `apps/web/src/lib/call/call-engine.ts:59-72` отображает `Connecting -> connecting`, `Connected -> connected`, `Reconnecting -> reconnecting`, `Disconnected -> disconnected`.
- `apps/web/src/lib/call/call-engine.ts:207-222` вызывает `refresh()` на `RoomEvent.ConnectionStateChanged` и `RoomEvent.Disconnected`.
- `apps/web/src/lib/call/call-engine.ts:176-185` заново строит stage и controls из текущего `Room`.
- `apps/web/src/lib/call/call-engine.ts:304-325` делает initial `room.connect`, затем публикует media и один раз отправляет participant state `joined`.
- `apps/web/src/lib/call/call-engine.ts:395-400` отправляет `left` только при явном leave; cleanup делает то же через idempotent guard.
- `apps/web/src/widgets/call/call-stage.tsx:23-30` показывает `В эфире`, `Переподключение…`, `Звонок завершён`, `Ошибка связи`.

Механика успешного SDK reconnect выглядит правдоподобно: engine слушает state changes и не создаёт новую API-сессию. Но это только статическое ожидание. Терминальный `Disconnected` не выставляет `error`; ActiveStep остаётся на сцене с controls и chat, а UI подписывает состояние как `Звонок завершён`. Поэтому длительный outage может закончиться не recovery, а внешне завершённым, но всё ещё интерактивным экраном. Это отдельный UX/occupancy риск, который нельзя скрывать успешным коротким pause-тестом.

## Состояние тестов

`apps/web/src/lib/call/call-engine.test.tsx` содержит шесть тестов lifecycle/error/Jitsi. Reconnect coverage отсутствует:

- `MockRoom.on` возвращает `this`, но не сохраняет listeners (`:100`), поэтому тест не может эмитить `ConnectionStateChanged`/`Disconnected`;
- `connect()` сразу присваивает `Connected`, `disconnect()` присваивает `Disconnected`, но ни один тест не проверяет stage phase;
- нет assertions для `connected -> reconnecting -> connected`;
- нет assertions для terminal `disconnected`, сохранения roster/controls или отсутствия повторных join/token/state вызовов;
- нет component test для phase labels;
- найденная Storybook story `Reconnecting` статична и помечена как preview без backend, поэтому runtime evidence ею не является.

До принятия browser evidence нужен targeted test, где mock хранит callbacks и явно эмитит state changes. Он обязан доказать: `connected -> reconnecting -> connected`, terminal `disconnected`, отсутствие `error` на успешном reconnect, отсутствие нового `room.connect`, join-token и `joined/left`, а также сохранение ожидаемых controls/roster. Отдельный UI test должен связать phases с фактическими labels. Оба теста должны пройти свежим запуском; существующий зелёный suite этого не доказывает.

## Обязательные assertions

Ниже минимальный полный набор. Один общий run должен использовать две независимые browser contexts A и B, одну комнату и одну active session. Все реальные идентификаторы в evidence заменяются стабильными run-local псевдонимами.

### UI и browser

1. До каждого fault A и B одновременно показывают `В эфире`, ровно две participant tiles, правильную remote identity, отсутствие join/error banner и ожидаемые `aria-pressed` для mic/camera/screen controls.
2. Контексты действительно разные: разные авторизованные пользователи и независимые cookie jars. Storage state/cookies в evidence не сохраняются.
3. Offline-сценарий отключает сеть только у A. A в той же странице наблюдаемо переходит `В эфире -> Переподключение…`; B не теряет собственную сцену. Ни у кого не появляется `Ошибка связи`, `Звонок завершён` или возврат в lobby.
4. После возврата A online обе страницы без reload/remount возвращаются в `В эфире`, снова показывают две tiles с теми же user pseudonyms и прежними локальными control states.
5. Server-pause сценарий начинается с нового подтверждённого baseline. После pause обе страницы наблюдаемо переходят в `Переподключение…`; после unpause обе без reload/remount возвращаются в `В эфире` с двумя участниками.
6. На всём интервале fault/recovery нет page reload, navigation, повторного lobby join, внешнего Jitsi/manual path или ручного повторного подключения.
7. Для каждого checkpoint есть синхронизированная пара скриншотов либо один side-by-side screenshot A+B и machine-readable snapshot DOM assertions. Обязательные checkpoints: baseline, offline/reconnecting, offline/recovered, pre-pause baseline, paused/reconnecting, unpaused/recovered.

### Media

1. Перед каждым fault двунаправленно A->B и B->A доказано движение video frames не менее 3 секунд: remote `<video>` имеет ненулевые dimensions/достаточный readyState и растущие `currentTime` или decoded-frame counter.
2. Перед каждым fault двунаправленно доказан audio receive: remote audio track live/unmuted и `bytesReceived`/audio-energy counter растёт в интервале не менее 3 секунд. Сам факт существования `<audio>` не считается.
3. После каждого recovery для обоих направлений снова растут новые video frame и audio receive counters с timestamp позже online/unpause. Старый замороженный кадр не считается recovery.
4. Remote participant identity должна сохраниться. Track SID может измениться при SDK recovery и сам по себе не является fail, если публикации и media реально восстановлены.

### API/control plane

1. Room create: `201` один раз; session start: `201` один раз; второй пользователь получает ту же active session через `GET /api/workspace/call-rooms/:roomId` (`200`), а не создаёт новую.
2. Для A и B initial `POST .../join-token` возвращает `200` ровно по одному разу; response body, JWT и join URL не сохраняются. `POST .../turn-credentials` также фиксируется только status/count, без body.
3. Для A и B initial `POST .../participant-state` с `joined` возвращает `200` ровно по одному разу.
4. До fault, во время fault и после recovery `GET /api/workspace/call-rooms/:roomId` и `GET .../events` возвращают `200`, тот же pseudonymous room/session correlation, room `active`, session `active`.
5. Между baseline и обоими recovery нет нового `session_started`, `join_token_issued`, `participant_joined`, `participant_left` или `session_ended`; нет новых start/join-token/participant-state network calls. Иначе это rejoin/recreate, а не reconnect.
6. До cleanup event cardinality для данного run: один `room_created`, один `session_started`, два `join_token_issued`, два `participant_joined`, ноль `participant_left`, ноль `session_ended`. Cleanup events проверяются отдельно и не подменяют recovery proof.
7. API network assertions должны быть собраны allowlist-инструментом, который сохраняет method/path-template/status/count/timestamp, но не headers, cookies, query values и response/request bodies.

### LiveKit/server

1. Перед pause серверная проверка подтверждает service `livekit` running и ровно двух участников в одной комнате; room/participant values в evidence только псевдонимизированы.
2. `docker compose pause livekit` завершается exit `0`; узкий `docker inspect --format` подтверждает `Running=true`, `Paused=true`. Полный inspect запрещён.
3. Pause удерживается до наблюдаемого `Переподключение…` у A и B, но не дольше 45 секунд. Если оба перехода не получены за 45 секунд, сценарий FAIL; нельзя подменять их ожиданием после unpause.
4. `docker compose unpause livekit` завершается exit `0`; inspect подтверждает `Running=true`, `Paused=false`. Container ID и StartedAt до/после совпадают: stop/start/recreate не считается pause/unpause.
5. Не позднее 45 секунд после unpause обе страницы возвращаются в `В эфире`, server room снова сообщает двух участников, а media assertions проходят в обоих направлениях.
6. Server command receipt содержит timestamp, exit code, paused/running booleans, pseudonymous container fingerprint и participant count. Ни env, ни config dump, ни admin credentials, ни raw logs в receipt не допускаются.

## Evidence sanitation

### Текущий файл

Индикаторный scan текущего JSON дал ноль совпадений по JWT, bearer authorization, token/join-token keys, LiveKit API secret/key, password/credential keys, cookie headers, private keys, SDP session/ICE ufrag/ICE pwd/fingerprint и ICE candidates. `roomUrl` не содержит userinfo/query/fragment. Наличие строки о redaction не считалось доказательством; файл был просканирован отдельно.

При этом JSON содержит реальные room/session/event/user identifiers, timestamps, внутренний room URL и абсолютный локальный путь в stack trace. Это не join secret, но operational metadata. Для переносимого evidence их нужно заменить run-local псевдонимами; stack path сократить до repo-relative. События продублированы в двух API readbacks, что увеличивает лишнюю поверхность данных.

Рядом существуют незатреканные `_tmp_media_*` process logs. Они не входят в evidence-папку, часть файлов была активна/locked во время аудита, и поэтому они **не могут считаться sanitized evidence**, даже если эвристический scan доступных bytes не нашёл секретных индикаторов.

### Риски, которые обязан закрыть новый run

- join JWT/access token, Authorization bearer, session/CSRF cookies, browser storage state;
- LiveKit API key/secret, admin token, private keys;
- TURN username/credential/password и любые ответы `turn-credentials`;
- raw SDP: `v=0`, ICE ufrag/pwd, DTLS fingerprint и прочие `a=` media lines;
- ICE candidates, host/srflx/relay IP/port, mDNS names и candidate-pair dumps;
- WebSocket URL/query token, signaling frames и join request/response bodies;
- HAR, Playwright trace ZIP, DevTools network export, WebRTC internals dump;
- unfiltered browser console, LiveKit debug/server logs и crash dumps;
- full `docker inspect`, `docker compose config`, environment/config dumps;
- screenshots/video с address bar, devtools, real user names, room/session IDs, notifications или tokens;
- local absolute paths, machine/user names и unrelated tenant data;
- binary metadata/archives, которые текстовый scanner не может проверить.

Разрешённый artifact set: sanitized Markdown/JSON assertion summaries и визуально проверенные PNG checkpoints. Raw HAR/trace/storage state/SDP/ICE/log archives не сохраняются вовсе. Перед приёмкой нужен zero-hit automated scan по перечисленным secret/SDP/ICE классам, recursive JSON-key audit, ручная визуальная проверка каждого PNG и manifest с SHA-256 всех принятых файлов. Scanner output должен содержать только category/count/file, никогда matched value.

## Exact pass/fail gate

**PASS разрешён только при одновременном выполнении всех условий:**

1. Есть один correlation manifest с commit SHA, UTC timestamps, browser/runtime versions, LiveKit image version, declared 45-second transition deadlines, pseudonyms A/B и SHA-256 evidence files; без секретов.
2. Targeted call-engine connection-state test и UI phase-label test проходят свежим command-backed запуском и покрывают assertions из раздела тестов.
3. Baseline A+B проходит все UI и двунаправленные media assertions.
4. Offline(A)->online проходит полную последовательность `connected -> reconnecting -> connected` без reload/rejoin и проходит post-recovery media/API assertions.
5. `pause livekit -> paused=true -> unpause livekit -> paused=false` проходит полную последовательность у обоих пользователей, с тем же container instance, room/session и post-recovery media.
6. API event/network deltas точно соответствуют control-plane assertions: никаких duplicate join/start/token/state событий или вызовов во время recovery.
7. Server participant count равен двум до и после server recovery; команды и состояния сервера timestamp-correlated с UI timeline.
8. Все checkpoints имеют paired visual + machine-readable evidence; ни один expected transition не выведен только из финального состояния.
9. Sanitation gate даёт zero hits, JSON-key audit и PNG review проходят, forbidden raw artifacts отсутствуют.

**FAIL немедленно**, если отсутствует хотя бы один обязательный checkpoint/assertion; любой клиент не показывает `Переподключение…`; появляется terminal `Звонок завершён`/`Ошибка связи`; нужен reload/manual rejoin; media не возобновляется в любом направлении; меняется session/container instance; появляются повторные control-plane calls/events; deadline превышен; server pause не доказан; либо sanitation неполна/находит запрещённые данные.

**INCONCLUSIVE**, а не PASS, если fault был применён, но нет синхронизированной timeline/paired evidence, media проверена только DOM presence, server state или API delta не сняты, либо артефакт недоступен/locked/неподдаётся sanitation. Повторный успешный join после reload относится к отдельному rejoin-тесту и не повышает reconnect verdict.

## Итог

Текущий evidence остаётся **REJECT**. Он полезен как failure record начального signal connection, но не закрывает ни одну reconnect-ветку. Главный агент должен провести оба fault-сценария на двух реальных независимых browser contexts, сохранить непрерывность UI/media/API/server identity и предъявить только минимальные sanitized summaries/checkpoints по gate выше.
