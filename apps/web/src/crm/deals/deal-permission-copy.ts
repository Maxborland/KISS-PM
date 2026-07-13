export function kanbanInteractionHint(canManageDeals: boolean): string {
  return canManageDeals
    ? "Перетащите карточку между стадиями (переход проверяется условиями воронки)."
    : "Канбан доступен только для просмотра; перенос выполняет пользователь с правом управления сделками.";
}

export function feasibilityEmptyCopy(canCheckFeasibility: boolean, disabledReason: string): string {
  return canCheckFeasibility
    ? "Проверка осуществимости ещё не запускалась. Нажмите «Проверить» — сервер оценит ресурсы по плановым часам, спросу и активным проектам."
    : `Проверка осуществимости ещё не запускалась. Её может запустить пользователь с правом управления сделками. ${disabledReason}.`;
}
