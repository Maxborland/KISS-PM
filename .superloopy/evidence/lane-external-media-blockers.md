# Аудит внешних media-блокеров

Дата повторной оценки: 2026-07-10 (Asia/Novosibirsk)
Область: Jitsi moderator/auth gate и публикация физической/OBS-камеры
Режим: только чтение, безопасные connectivity/device-пробы и отчёт

## Итог

Аудит классификации: **PASS**. Это не media-pass.

| Пункт | Классификация | Media-результат |
|---|---|---|
| Jitsi `meet.jit.si` moderator/auth gate | **EXTERNAL BLOCKER** | **UNVERIFIED**: конференция и реальный audio/video track не были запущены |
| Физическая/OBS-камера через LiveKit | **EXTERNAL BLOCKER** | **UNVERIFIED**: свежего `kind=video source=CAMERA` track нет |

Ни один connectivity-ответ, открывшаяся страница, разрешение браузера, найденное устройство или активная call session не считаются доказательством media success. Для такого утверждения нужен свежий реальный track и его provider/remote readback.

## Источники

1. Jitsi browser evidence от 2026-07-08: [`risk-media-jitsi-obs-mic-blocked-2026-07-08.json`](../../docs/qa/full-eval/evidence/browser-media-jitsi-obs-mic-blocked-2026-07-08/risk-media-jitsi-obs-mic-blocked-2026-07-08.json), SHA-256 `EC27B221BE03AC6E9E2E90D508FE5D5753F40144BEC047F1A5417E3B0DA2E4EB`.
2. LiveKit physical/OBS evidence от 2026-07-09: [`risk-media-livekit-physical-camera-obs-2026-07-09.json`](../../docs/qa/full-eval/evidence/browser-media-livekit-physical-camera-2026-07-09/risk-media-livekit-physical-camera-obs-2026-07-09.json), SHA-256 `D69FCE938E253A1A973F32DDE85AB63D54597B566A34BD8AD0A8E1685C02D6B4`.
3. Текущий provider contract: [`apps/api/src/videoProvider.ts`](../../apps/api/src/videoProvider.ts), строки 26-35, 42-71, 84-95; SHA-256 `05B53FCCE083E20F09FCE58AA267EEB92F17AC6D3716A5BA326330ACA431DA25`.
4. Текущая логика публикации/деградации камеры: [`apps/web/src/lib/call/call-engine.ts`](../../apps/web/src/lib/call/call-engine.ts), строки 90-101 и 312-319; SHA-256 `4903B4DB8DBCB496F2459D80948A7603256A59261ED11C441A62D2F3A805D831`.
5. Текущий deployment contract: [`.env.example`](../../.env.example), строки 8-17; [`docker-compose.yml`](../../docker-compose.yml), строки 72-81 и 153-175; [`backend-operations.md`](../../docs/runbooks/backend-operations.md), строки 24-30.
6. Актуальная документация Jitsi: [Join a Jitsi Meeting](https://jitsi.github.io/handbook/docs/user-guide/user-guide-join-jitsi-meeting/), [Start a Jitsi Meeting](https://jitsi.github.io/handbook/docs/user-guide/user-guide-start-a-jitsi-meeting/), [Secure Domain Setup](https://jitsi.github.io/handbook/docs/devops-guide/secure-domain/). На 2026-07-10 документация прямо требует от первого участника `meet.jit.si` аутентифицироваться либо ждать модератора; для новых self-hosted установок рекомендует JWT вместо deprecated secure-domain flow.

Секреты, join tokens, SDP, ICE credentials/candidates и browser auth state в этот отчёт не записывались.

## Текущий runtime и конфигурация

- `.env.local` и environment текущей PowerShell-сессии не содержат `KISS_PM_VIDEO_*` значений. `.env.example` содержит только закомментированный LiveKit dev-рецепт.
- Запущенный API создан другим launch-контекстом. Его точный `KISS_PM_VIDEO_PROVIDER` нельзя честно вывести из shell environment; защищённый GET существующей call room отвечает `401`. Поэтому **provider запущенного API остаётся unverified**.
- Docker runtime: `livekit/livekit-server:v1.9.12` запущен; опубликованы TCP `7880/7881` и UDP `50000-50019`.
- Свежие TCP/HTTP-пробы: `3180`, `4180`, `7880`, `7881` доступны; web `/` = `200`; API `/health/live` = `200`; API `/health/ready` = `200`; LiveKit `/` = `200`.
- `/health/ready` сообщает только `database=ok` и `storage=ok`; media readiness check отсутствует. Это не доказательство доступности media publication path.
- Внешний HEAD `https://meet.jit.si/` от 2026-07-09 18:31:37 UTC = `200 OK`, release `6916`, region `eu-central-1`. Это подтверждает только доступность web endpoint.

## Jitsi moderator/auth gate

### Воспроизводимый статус

- Evidence [1] показывает полный KISS PM handoff: room/session созданы, join response = `provider: jitsi`, URL на `https://meet.jit.si/<room>`, `token: null`, `expiresAt: null`.
- Браузер дошёл до внешней waiting room и получил сообщение, что конференция ещё не началась, потому что модератор не пришёл; предлагалось войти как организатор.
- Текущий код [3] подтверждает это как контракт, а не случайный сбой: для `manual` и `jitsi` API формирует только `joinUrl`; auth token отсутствует по определению.
- Текущая документация Jitsi [6] независимо подтверждает provider behavior: первый участник публичного `meet.jit.si` должен аутентифицироваться через поддерживаемый внешний аккаунт либо ждать модератора.
- Свежий HEAD подтверждает доступность Jitsi, но не запуск конференции и не media track.

### Классификация

**EXTERNAL BLOCKER**, не подтверждённый product bug.

Блокирующее условие находится у публичного Jitsi provider: нужен аутентифицированный первый участник/модератор. Текущий KISS PM Jitsi contract не обещает и не выдаёт moderator JWT. Если продуктовая цель будет изменена на полностью автоматический moderated Jitsi join, это станет новой product capability/contract change; текущих требований и доказательств такого обещания нет.

### Точная внешняя предпосылка

Для публичного `meet.jit.si`: в реальном интерактивном браузере должен быть доступен человек с поддерживаемой Jitsi external-auth учётной записью, который войдёт первым и запустит точную room из KISS PM `joinUrl`.

Допустимая инфраструктурная альтернатива: управляемый/self-hosted Jitsi, где создание комнаты разрешено выбранной auth-моделью. Для JWT-модели потребуется отдельная проверка совместимости, потому что текущий KISS PM Jitsi contract передаёт `token: null`.

### Процедура повтора

1. Запустить API с явно заданными `KISS_PM_VIDEO_PROVIDER=jitsi` и `KISS_PM_VIDEO_JITSI_BASE_URL`; не помещать credentials в команды, логи или evidence.
2. Создать новую уникальную video room через пользовательский KISS PM flow и получить handoff URL.
3. В отдельном интерактивном Chrome открыть тот же URL первым участником, выполнить provider login и дождаться реально стартовавшей конференции. Waiting room не является pass.
4. Из KISS PM открыть handoff вторым участником и разрешить устройства вручную, если браузер просит.
5. Зафиксировать media proof без секретов: локальный `MediaStreamTrack` с `kind=audio|video`, `readyState=live`; рост WebRTC outbound RTP counters; у второго участника реальный inbound track и рост receive/frames counters.
6. Только после пунктов 3-5 разрешено изменить media-вердикт на pass. Один `200`, join URL, DOM `<video>` без `srcObject`, lobby или call session недостаточны.

## Физическая/OBS-камера через LiveKit

### Воспроизводимый статус

- Evidence [2] показывает: Chrome permissions `camera=granted`, `microphone=granted`; `OBS Virtual Camera` перечислена; прямой `getUserMedia({video:true})` завершился `NotReadableError: Could not start video source` до LiveKit publication.
- В том же evidence есть реальный LiveKit `MICROPHONE` audio track, но явно отсутствует `mediaTrack published ... kind=video source=CAMERA`. Поэтому аудио доказано, видео нет.
- Текущий клиент [4] вызывает `setCameraEnabled(...)`, честно оставляет camera-off при исключении и считает камеру включённой только при наличии немьютнутой camera publication с video track.
- Свежая системная проба 2026-07-10: процесс OBS не запущен. DirectShow перечисляет `OBS Virtual Camera`, но чтение одного кадра завершается `Could not find output pin from video capture device` / `I/O error`. Другой video input в DirectShow-списке не найден.
- LiveKit signalling/RTC endpoints доступны, то есть текущий наблюдаемый блокер находится до публикации, на camera source boundary.

### Классификация

**EXTERNAL BLOCKER**, не product bug. Успешная camera publication остаётся **UNVERIFIED**.

Отказ воспроизводится вне KISS PM на прямом browser/DirectShow source access. Продукт корректно деградирует в camera-off и ранее опубликовал реальный audio track; доказательств ошибки token grant, LiveKit signalling или UI false-positive нет.

### Точная внешняя предпосылка

Должен существовать реально отдающий кадры video source:

- либо OBS Studio запущен, сцена содержит активный visual source и `Start Virtual Camera` включён;
- либо подключена и не заблокирована другим процессом физическая камера.

До входа в KISS PM этот source обязан успешно отдать хотя бы один кадр через OS/DirectShow. Затем Chrome для origin KISS PM должен иметь camera permission, а LiveKit signalling `7880`, RTC/TCP `7881` и media UDP path должны быть доступны.

### Процедура повтора

1. Запустить OBS Studio, выбрать непустую сцену и включить Virtual Camera; либо подключить исправную физическую камеру. Закрыть приложения, которые могут держать устройство эксклюзивно.
2. Проверить source вне продукта:

   ```powershell
   ffmpeg -hide_banner -f dshow -i video="OBS Virtual Camera" -frames:v 1 -f null -
   ```

   Продолжать только при успешном чтении кадра. Текущий результат этой команды: `I/O error`, значит prerequisite сейчас не выполнен.
3. Проверить инфраструктуру без токенов: `GET http://127.0.0.1:7880/`, API `/health/live`, TCP `7880/7881`; при удалённом развёртывании также проверить разрешённый UDP media range.
4. В user Chrome открыть новую KISS PM LiveKit room, в lobby выбрать рабочий source, включить camera и войти в звонок.
5. Зафиксировать локальный video track: `kind=video`, `readyState=live`, `enabled=true`, непустые settings и растущие outbound `bytesSent`/`framesEncoded`.
6. Зафиксировать provider proof: свежая строка LiveKit `mediaTrack published` с `kind=video source=CAMERA`, без SDP/ICE/token material.
7. Зафиксировать независимый remote proof: второй участник получает video track, `readyState=live`, а inbound `bytesReceived`/`framesDecoded` растут.
8. Только совокупность пунктов 5-7 является camera media-pass. Device enumeration, permission `granted`, активная session, UI camera-on без track или один локальный preview недостаточны.

## Выполненные проверки

```text
pnpm vitest run apps/api/src/videoProvider.test.ts apps/web/src/lib/call/call-engine.test.tsx
2 files passed, 20 tests passed

Local TCP: 3180=true, 4180=true, 7880=true, 7881=true
HTTP: web/=200, API /health/live=200, API /health/ready=200, LiveKit/=200
External HEAD: https://meet.jit.si/=200
OBS process: absent
DirectShow: OBS Virtual Camera enumerated; one-frame open failed with output-pin/I/O error
```

Эти проверки подтверждают классификацию и retry recipe. Они не публиковали свежий audio/video track и поэтому не меняют оба media-результата с `UNVERIFIED`.

## Решение аудитора

- Jitsi: оставить как **external moderator/auth blocker** до предоставления реального authenticated moderator path. Не считать connectivity или waiting room pass.
- OBS/physical camera: оставить как **external camera-source blocker** до успешного кадра вне продукта и свежей LiveKit `CAMERA` publication с remote readback.
- Product defect по имеющимся данным не доказан ни для одного пункта.
- Перепроверка возможна сразу после выполнения указанных внешних предпосылок; product/DNS/provider/browser-permission изменения в рамках этого аудита не выполнялись.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/lane-external-media-blockers.md
