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

export function canStartDealCreation(data: {
  permissions: readonly string[];
  clients: readonly { status: string }[];
  contacts: readonly { status: string }[];
  projectTypes: readonly { status: string }[];
  dealStages: readonly { status: string }[];
  positions: readonly unknown[];
}): boolean {
  return (
    hasPermission(data.permissions, "tenant.opportunities.manage") &&
    data.clients.some((client) => client.status === "active") &&
    data.contacts.some((contact) => contact.status === "active") &&
    data.projectTypes.some((projectType) => projectType.status === "active") &&
    data.dealStages.some((stage) => stage.status === "active") &&
    data.positions.length > 0
  );
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
  client_not_found: "Клиент не найден или недоступен.",
  contact_not_found: "Контакт не найден или не относится к выбранному клиенту.",
  duplicate_demand_position: "Должность в потребности нельзя дублировать.",
  deal_stage_not_found: "Этап сделки не найден или недоступен.",
  feasibility_required: "Сначала выполните ресурсную проверку.",
  invalid_client_id: "Выберите корректного клиента.",
  invalid_contact_email: "Проверьте email контакта.",
  invalid_contact_id: "Выберите корректный контакт.",
  invalid_contact_name: "Укажите имя контакта.",
  invalid_contact_phone: "Телефон контакта слишком длинный.",
  invalid_contact_role: "Роль контакта слишком длинная.",
  invalid_contact_telegram: "Telegram контакта слишком длинный.",
  invalid_config_id: "Системный идентификатор имеет недопустимый формат.",
  invalid_contract_value: "Стоимость контракта должна быть больше 0.",
  invalid_config_status: "Выберите корректный статус.",
  invalid_deal_stage_id: "Выберите корректный этап сделки.",
  invalid_deal_stage_name: "Укажите название этапа сделки.",
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
  invalid_project_type_id: "Выберите корректный тип проекта.",
  invalid_project_type_name: "Укажите название типа проекта.",
  invalid_primary_contact_id: "Выберите корректный контакт клиента.",
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
  opportunity_id_taken: "Сделка с таким идентификатором уже существует.",
  opportunity_not_feasible: "Эту возможность уже нельзя повторно проверять.",
  opportunity_not_activatable: "Эту возможность нельзя активировать.",
  opportunity_not_found: "Сделка не найдена.",
  opportunity_stage_locked: "Этап завершенной сделки нельзя менять.",
  project_type_not_found: "Тип проекта не найден или недоступен.",
  risk_acceptance_required: "Для ресурсного конфликта нужно указать принятие риска.",
  session_required: "Сессия истекла. Войдите заново.",
  system_key_immutable: "Системный ключ нельзя изменить после создания."
};
