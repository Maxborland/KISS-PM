import { ApiError } from "./api";

export type SectionState = {
  canRead: boolean;
  isLoading: boolean;
  error: string | null;
};

export function getSectionState(
  canRead: boolean,
  isLoading: boolean,
  error: unknown
): SectionState {
  return {
    canRead,
    isLoading: canRead && isLoading,
    error: canRead && error ? getErrorMessage(error) : null
  };
}

export function getMetricHint(state: SectionState): string {
  if (!state.canRead) return "Нет права на чтение";
  if (state.isLoading) return "Обновляем";
  if (state.error) return "Ошибка загрузки";
  return "Актуально";
}

export function hasPermission(
  permissions: readonly string[],
  permission: string
): boolean {
  return permissions.includes(permission);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return (
      apiErrorMessages[error.code] ??
      `Не удалось выполнить действие. Код ошибки: ${error.code}`
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Не удалось выполнить действие";
}

const apiErrorMessages: Record<string, string> = {
  access_denied: "Недостаточно прав для этого действия.",
  custom_field_id_taken: "Поле с таким идентификатором уже существует.",
  custom_field_not_found: "Пользовательское поле не найдено.",
  custom_field_system_key_taken: "Поле с таким системным ключом уже существует.",
  invalid_body: "Проверьте данные формы.",
  invalid_config_id: "Системный идентификатор имеет недопустимый формат.",
  invalid_config_status: "Выберите корректный статус.",
  invalid_description: "Описание слишком длинное.",
  invalid_field_type: "Выберите корректный тип поля.",
  invalid_required_flag: "Некорректный признак обязательности.",
  invalid_system_key: "Системный ключ: латиница, цифры и _, начинается с буквы.",
  invalid_target_entity: "Целевая сущность пока должна быть проектом.",
  invalid_tenant_label: "Укажите название для интерфейса.",
  project_template_id_taken: "Шаблон с таким идентификатором уже существует.",
  project_template_not_found: "Шаблон проекта не найден.",
  project_template_system_key_taken: "Шаблон с таким системным ключом уже существует.",
  session_required: "Сессия истекла. Войдите заново.",
  system_key_immutable: "Системный ключ нельзя изменить после создания."
};
