/**
 * Единственная «превью»-поверхность блока — Storybook-двойник ChatWidget: он рендерится
 * disabled с плашкой «бэкенд не подключён» (widgets/chat/chat-widget.tsx — единственный
 * потребитель isUiOnlyPreview). Живые роуты «Чат/Звонки/Встречи/Уведомления» идут на боевой
 * контракт /api/workspace/* и в этот список НЕ входят.
 *
 * Раньше список содержал 9 имён (kpi/audit/baseline/scenarios/notificationCenter/calls/
 * meetings/notifications + chat) как «static mocks until backend is connected», но 8 из них
 * не имели ни одного потребителя (мёртвые флаги, ничего не гейтили) — удалены (честность
 * блока 12: флаг не должен утверждать «превью» там, где поверхность уже на боевом API).
 */
export const UI_ONLY_PREVIEW_SURFACES = ["chat"] as const;

export type UiOnlyPreviewSurface = (typeof UI_ONLY_PREVIEW_SURFACES)[number];

export function isUiOnlyPreview(surface: UiOnlyPreviewSurface): boolean {
  return UI_ONLY_PREVIEW_SURFACES.includes(surface);
}

export const UI_ONLY_PREVIEW_BANNER_TEXT = "Превью — бэкенд не подключён";
