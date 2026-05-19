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
  duplicate_demand_position: "Должность в потребности нельзя дублировать.",
  feasibility_required: "Сначала выполните ресурсную проверку.",
  invalid_config_id: "Системный идентификатор имеет недопустимый формат.",
  invalid_contract_value: "Стоимость контракта должна быть больше 0.",
  invalid_config_status: "Выберите корректный статус.",
  invalid_description: "Описание слишком длинное.",
  invalid_demand: "Добавьте потребность по должностям.",
  invalid_demand_hours: "Часы потребности должны быть положительным целым числом.",
  invalid_demand_position: "Выберите корректную должность в потребности.",
  invalid_field_type: "Выберите корректный тип поля.",
  invalid_opportunity_id: "Идентификатор возможности имеет недопустимый формат.",
  invalid_planned_dates: "Проверьте плановые даты проекта.",
  invalid_planned_hourly_rate: "Плановая норма часа должна быть больше 0.",
  invalid_probability: "Вероятность должна быть от 0 до 100.",
  invalid_project_id: "Идентификатор проекта имеет недопустимый формат.",
  invalid_project_type: "Укажите тип проекта.",
  invalid_required_flag: "Некорректный признак обязательности.",
  invalid_risk_reason: "Причина принятия риска слишком длинная.",
  invalid_client_name: "Укажите клиента.",
  invalid_opportunity_title: "Укажите название входящего проекта.",
  invalid_system_key: "Системный ключ: латиница, цифры и _, начинается с буквы.",
  invalid_target_entity: "Целевая сущность пока должна быть проектом.",
  invalid_template_id: "Шаблон проекта имеет недопустимый идентификатор.",
  invalid_tenant_label: "Укажите название для интерфейса.",
  project_template_id_taken: "Шаблон с таким идентификатором уже существует.",
  project_template_not_found: "Шаблон проекта не найден.",
  project_template_system_key_taken: "Шаблон с таким системным ключом уже существует.",
  opportunity_id_taken: "Возможность с таким идентификатором уже существует.",
  opportunity_not_feasible: "Эту возможность уже нельзя повторно проверять.",
  opportunity_not_activatable: "Эту возможность нельзя активировать.",
  opportunity_not_found: "Возможность не найдена.",
  risk_acceptance_required: "Для ресурсного конфликта нужно указать принятие риска.",
  session_required: "Сессия истекла. Войдите заново.",
  system_key_immutable: "Системный ключ нельзя изменить после создания."
};
