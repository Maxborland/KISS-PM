/**
 * Честность Storybook-прототипа.
 *
 * Каркас интерфейса KISS PM — это прототип для продуктового ревью, а не рабочее
 * приложение. Действия, не подключённые к API/read-model, НЕ должны выглядеть
 * рабочими. Эти помощники помечают такие действия честно.
 *
 * См. docs/design-v3/STORYBOOK-INTERFACE-AUDIT-2026-06-22.md (P1 fake-affordances).
 */

/** Единая подпись прототипа для маркеров и баннеров. */
export const PROTOTYPE_LABEL = "Прототип";

/** Текст для маркера: «прототип — действия не сохраняются». */
export const PROTOTYPE_NOTE = "Прототип · действия не сохраняются";

/**
 * Пропсы для кнопки/иконки без подключённого сценария: честно `disabled` + `title`.
 *
 * @example <Button variant="primary" {...demoAction("создание сделки")}>Сделка</Button>
 */
export function demoAction(what: string): { disabled: true; title: string } {
  return { disabled: true, title: `Демо-прототип: ${what} подключится к рабочему приложению` };
}

/** Title для нерабочей навигации (ссылки сайдбара/крошек), которые остаются видимыми. */
export const DEMO_NAV_TITLE = "Демо-прототип: навигация подключится в рабочем приложении";
