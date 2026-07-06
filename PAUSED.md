# ⏸ PAUSED — session handoff (2026-06-26)

**Почему пауза:** пивот на **смену дизайн-языка** (см. `[[design-system-shadcn-tw-bento]]` —
сильная shadcn + Tailwind v4 + bento-система вместо текущего BEM-микса; токены можно менять).
Текущая WIP заморожена и зачекпойнчена, чтобы ничего не потерять до пивота.

> Это session-level handoff. Есть и per-package PAUSED:
> `packages/planning-gantt-ui/PAUSED.md`.
> (`planning-client` больше не paused — с 2026-07 это боевая runtime-зависимость
> delivery-контура `apps/web`, см. `apps/web/src/delivery/lib/planning-client.ts`.)

---

## 1. Состояние веток

- **`codex/comms-self-hosted-av`** (PR #206, ~29 коммитов, база `codex/backend-prod-go-no-go-fixes`) —
  эпик собственной A/V-связи **ЗАКРЫТ ПО КОДУ + 3 раунда ревью Codex**. Это отдельная ветка/PR,
  НЕ связана с дизайн-пивотом. Полный лог — в памяти `comms-self-hosted-av-epic.md` и
  `docs/plans/communications-self-hosted-av-epic.md`.
- **`codex/dashboard-table-ui-audit`** (ТЕКУЩАЯ, base = comms@bcbb4bf, стекнута) — здесь лежит
  WIP дизайн/дашборд-аудита + куча незатреканной работы. Этот чекпойнт-коммит — про неё.
  ⚠️ Ветка стекнута на comms, поэтому диф к master включает и comms-работу.

## 2. Что в этом чекпойнте (WIP, не финал)

Затрекано как «wip» одним коммитом, чтобы не потерять перед пивотом дизайна:
- `apps/web/src/components/ui/table.tsx` (M) — правка таблицы (dashboard-table-ui-audit).
- Незатреканная WIP: `apps/web/src/app/{admin,agent,dashboard,deals,my-work,projects,settings}/`,
  `apps/web/src/views/{marketing,screens/runtime-screen-view.tsx}`, `apps/web/src/widgets/landing-agent-demo/`,
  `apps/web/src/styles/widgets/landing-agent-demo.css`, `docs/{design,audit,beta,infra,marketing,references}/`,
  `.github/workflows/release-gate.yml`, `e2e/smoke/production-business-flow.spec.ts`, `.agents/`, `LICENSE`, `proof-*.png`.
- **Исключено из git:** `.kiss-pm-storage/` (runtime file-assets локального storage) → в `.gitignore`.

⚠️ Содержимое незатреканной кучи накопилось вне моих правок этой сессии — оно зачекпойнчено
«как есть», без инвентаризации. Перед мержем разобрать по тематикам (дизайн vs доки vs инфра).

## 3. Дизайн-пивот (следующая работа)

Меняем дизайн-язык. Направление из памяти:
- `[[design-system-shadcn-tw-bento]]` — целимся в сильную shadcn (new-york) + Tailwind v4 + bento;
  токены мои, можно ломать текущий BEM-микш.
- `[[handoff-redesign-direction]]` — Storybook = контракт хэндофа back↔front; Project Delivery
  первым в одобренной точности; **Storybook-фиделити НЕ утверждён** (этим заблокированы
  фронт-углубления comms: редьюсер движка, шов камеры, `<VideoSlot>`, общий сборщик экрана).
- `[[globals-plugin-after-imports]]` — Tailwind v4 `@plugin` строго ПОСЛЕ всех `@import`.
- `[[storybook-gate-copy-scan-quirk]]` — `verify:storybook-contract` сканирует nav-дерево, не превью;
  EN_DEV-слова в ТАЙТЛАХ сторей валят весь гейт.
- `[[dashboard-table-ui-audit]]` — 102 проверенных gap'а vs «3 dashboard flaws»; сначала общие
  примитивы; Figma-ключи.

Следствие: часть текущей WIP (BEM-стили, виджеты) будет переписана под новый язык.

## 4. Как возобновить

- **Comms (отдельно):** ветка `codex/comms-self-hosted-av` готова к ревью/мержу в свою базу.
  Отложен **R1** — обработка LiveKit room-webhooks (`participant_left/joined`) для авторитетного
  presence (нужен finder call-room по providerRoomId + дизайн tenant-резолва + `webhook.urls` в
  livekit.yaml). Делать на comms-ветке, не здесь.
- **Дизайн-пивот:** начать с утверждения Storybook-фиделити (Project Delivery), затем токены/
  примитивы shadcn+TW+bento, потом переезд экранов. Этот чекпойнт — точка отсчёта.
- **Гигиена:** при возврате — `git branch --show-current` ПЕРЕД git-операциями (в этой сессии
  коммит однажды сел на чужую ветку из-за переключения).
