import {
  isWorkspaceConfigFieldType,
  isWorkspaceConfigStatus,
  isWorkspaceConfigSystemKeyInput,
  isWorkspaceConfigTenantLabelInput,
  workspaceConfigDescriptionMaxLength
} from "@kiss-pm/domain";
import type { CustomFieldDefinition } from "./api";

export type FormErrors = Record<string, string>;
export type UserFormMode = "create" | "edit";

export type UserFormValidationInput = {
  name: string;
  email: string;
  password?: string;
  accessProfileId: string;
  status: string;
};

export function validateUserForm(
  input: UserFormValidationInput,
  mode: UserFormMode
): FormErrors {
  const errors: FormErrors = {};

  if (!input.name.trim()) errors.name = "Укажите имя пользователя.";
  if (!isEmail(input.email)) errors.email = "Введите корректный email.";
  if (mode === "create" && (input.password ?? "").trim().length < 8) {
    errors.password = "Пароль должен быть не короче 8 символов.";
  }
  if (!input.accessProfileId.trim()) errors.accessProfileId = "Выберите роль доступа.";
  if (input.status !== "active" && input.status !== "inactive") {
    errors.status = "Выберите корректный статус.";
  }

  return errors;
}

export function validateRoleForm(input: {
  name: string;
  permissions: string[];
}): FormErrors {
  const errors: FormErrors = {};

  if (!input.name.trim()) errors.name = "Укажите название роли.";
  if (input.permissions.length === 0) {
    errors.permissions = "Выберите хотя бы одно право.";
  }

  return errors;
}

export function validatePositionForm(input: { name: string }): FormErrors {
  const errors: FormErrors = {};

  if (!input.name.trim()) errors.name = "Укажите название должности.";

  return errors;
}

export function validateClientForm(input: {
  name: string;
  description: string;
  status?: string;
}): FormErrors {
  const errors: FormErrors = {};

  if (!input.name.trim()) errors.name = "Укажите клиента.";
  if (input.description.length > 1000) {
    errors.description = "Описание должно быть не длиннее 1000 символов.";
  }
  if (input.status !== undefined && !isCrmStatus(input.status)) {
    errors.status = "Выберите корректный статус справочника.";
  }

  return errors;
}

export function validateContactForm(input: {
  clientId: string;
  name: string;
  email: string;
  status?: string;
}): FormErrors {
  const errors: FormErrors = {};

  if (!input.clientId.trim()) errors.clientId = "Выберите клиента.";
  if (!input.name.trim()) errors.name = "Укажите контакт.";
  if (input.email.trim() && !isEmail(input.email)) {
    errors.email = "Введите корректный email контакта.";
  }
  if (input.status !== undefined && !isCrmStatus(input.status)) {
    errors.status = "Выберите корректный статус справочника.";
  }

  return errors;
}

export function validateProjectTypeForm(input: {
  name: string;
  description: string;
  status?: string;
}): FormErrors {
  const errors: FormErrors = {};

  if (!input.name.trim()) errors.name = "Укажите тип проекта.";
  if (input.description.length > 1000) {
    errors.description = "Описание должно быть не длиннее 1000 символов.";
  }
  if (input.status !== undefined && !isCrmStatus(input.status)) {
    errors.status = "Выберите корректный статус справочника.";
  }

  return errors;
}

export function validateProductForm(input: {
  name: string;
  sku: string;
  type: string;
  unit: string;
  price: string;
  description?: string;
  status?: string;
}): FormErrors {
  const errors: FormErrors = {};
  const price = Number(input.price);

  if (!input.name.trim()) errors.name = "Укажите товар или услугу.";
  if (input.sku.length > 80) errors.sku = "Артикул должен быть не длиннее 80 символов.";
  if (input.type !== "service" && input.type !== "goods") {
    errors.type = "Выберите тип позиции.";
  }
  if (!input.unit.trim()) errors.unit = "Укажите единицу измерения.";
  if (!Number.isInteger(price) || price <= 0) {
    errors.price = "Цена должна быть положительным целым числом.";
  }
  if ((input.description ?? "").length > 1000) {
    errors.description = "Описание должно быть не длиннее 1000 символов.";
  }
  if (input.status !== undefined && !isCrmStatus(input.status)) {
    errors.status = "Выберите корректный статус справочника.";
  }

  return errors;
}

export function validateDealStageForm(input: {
  name: string;
  sortOrder: string;
  status?: string;
}): FormErrors {
  const errors: FormErrors = {};
  const sortOrder = Number(input.sortOrder);

  if (!input.name.trim()) errors.name = "Укажите этап сделки.";
  if (!Number.isInteger(sortOrder) || sortOrder <= 0) {
    errors.sortOrder = "Порядок должен быть положительным целым числом.";
  }
  if (input.status !== undefined && !isCrmStatus(input.status)) {
    errors.status = "Выберите корректный статус справочника.";
  }

  return errors;
}

function isCrmStatus(value: string): boolean {
  return value === "active" || value === "archived";
}

export function validateCustomFieldForm(input: {
  systemKey: string;
  tenantLabel: string;
  targetEntity: string;
  fieldType: string;
  status: string;
}): FormErrors {
  const errors: FormErrors = {};

  if (!isWorkspaceConfigSystemKeyInput(input.systemKey)) {
    errors.systemKey = "Системный ключ: латиница, цифры и _, начинается с буквы.";
  }
  if (!isWorkspaceConfigTenantLabelInput(input.tenantLabel)) {
    errors.tenantLabel = "Укажите русское название поля.";
  }
  if (!["project", "opportunity"].includes(input.targetEntity)) {
    errors.targetEntity = "Выберите сущность: проект или сделка.";
  }
  if (!isWorkspaceConfigFieldType(input.fieldType)) {
    errors.fieldType = "Выберите тип поля.";
  }
  if (!isWorkspaceConfigStatus(input.status)) {
    errors.status = "Выберите статус настройки.";
  }

  return errors;
}

export function validateProjectTemplateForm(input: {
  systemKey: string;
  tenantLabel: string;
  description: string;
  status: string;
}): FormErrors {
  const errors: FormErrors = {};

  if (!isWorkspaceConfigSystemKeyInput(input.systemKey)) {
    errors.systemKey = "Системный ключ: латиница, цифры и _, начинается с буквы.";
  }
  if (!isWorkspaceConfigTenantLabelInput(input.tenantLabel)) {
    errors.tenantLabel = "Укажите название шаблона.";
  }
  if (input.description.length > workspaceConfigDescriptionMaxLength) {
    errors.description = "Описание должно быть не длиннее 1000 символов.";
  }
  if (!isWorkspaceConfigStatus(input.status)) {
    errors.status = "Выберите статус шаблона.";
  }

  return errors;
}

export function validateOpportunityForm(input: {
  clientId: string;
  primaryContactId: string;
  title: string;
  projectTypeId: string;
  stageId: string;
  plannedStart: string;
  plannedFinish: string;
  contractValue: string;
  plannedHourlyRate: string;
  probability: string;
  demand: { positionId: string; requiredHours: string }[];
}): FormErrors {
  const errors: FormErrors = {};
  const start = parseDateInput(input.plannedStart);
  const finish = parseDateInput(input.plannedFinish);
  const contractValue = Number(input.contractValue);
  const plannedHourlyRate = Number(input.plannedHourlyRate);
  const probability = Number(input.probability);

  if (!input.clientId.trim()) errors.clientId = "Выберите клиента.";
  if (!input.primaryContactId.trim()) {
    errors.primaryContactId = "Выберите контакт клиента.";
  }
  if (!input.title.trim()) errors.title = "Укажите название входящего проекта.";
  if (!input.projectTypeId.trim()) errors.projectTypeId = "Выберите тип проекта.";
  if (!input.stageId.trim()) errors.stageId = "Выберите этап сделки.";
  if (!start) errors.plannedStart = "Укажите дату старта.";
  if (!finish) {
    errors.plannedFinish = "Укажите плановый финиш.";
  } else if (start && finish.getTime() < start.getTime()) {
    errors.plannedFinish = "Дата финиша не может быть раньше старта.";
  }
  if (!Number.isInteger(contractValue) || contractValue <= 0) {
    errors.contractValue = "Стоимость контракта должна быть больше 0.";
  }
  if (!Number.isInteger(plannedHourlyRate) || plannedHourlyRate <= 0) {
    errors.plannedHourlyRate = "Плановая норма часа должна быть больше 0.";
  }
  if (!Number.isInteger(probability) || probability < 0 || probability > 100) {
    errors.probability = "Вероятность должна быть от 0 до 100.";
  }

  const filledDemand = input.demand.filter(
    (line) => line.positionId.trim() || line.requiredHours.trim()
  );
  if (filledDemand.length === 0) {
    errors.demand = "Добавьте хотя бы одну строку потребности.";
  }
  const hasInvalidDemand = filledDemand.some((line) => {
    const requiredHours = Number(line.requiredHours);
    return !line.positionId.trim() || !Number.isInteger(requiredHours) || requiredHours <= 0;
  });
  if (hasInvalidDemand) {
    errors.demand = "Каждая строка потребности должна содержать должность и часы.";
  }
  const positionIds = filledDemand.map((line) => line.positionId).filter(Boolean);
  if (new Set(positionIds).size !== positionIds.length) {
    errors.demandDuplicates = "Должность в потребности нельзя дублировать.";
  }

  return errors;
}

export function validateOpportunityCustomFields(
  customFields: CustomFieldDefinition[],
  values: Record<string, string>
): FormErrors {
  const errors: FormErrors = {};
  const activeOpportunityFields = customFields.filter(
    (field) => field.targetEntity === "opportunity" && field.status === "active"
  );

  for (const field of activeOpportunityFields) {
    const value = (values[field.id] ?? "").trim();
    if (field.required && !value) {
      errors[field.id] = `Заполните поле «${field.tenantLabel}».`;
      continue;
    }
    if (!value) continue;
    if (field.fieldType === "number" && !Number.isFinite(Number(value))) {
      errors[field.id] = `Поле «${field.tenantLabel}» должно быть числом.`;
    }
    if (field.fieldType === "date" && !parseDateInput(value)) {
      errors[field.id] = `Поле «${field.tenantLabel}» должно быть датой.`;
    }
  }

  return errors;
}

export function hasFormErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function getFieldErrorId(formId: string, field: string): string {
  return `${formId}-${field}-error`;
}

export function getNextFocusTrapIndex(
  currentIndex: number,
  focusableCount: number,
  isShiftPressed: boolean
): number | null {
  if (focusableCount <= 0) return null;
  if (isShiftPressed && currentIndex === 0) return focusableCount - 1;
  if (!isShiftPressed && currentIndex === focusableCount - 1) return 0;

  return null;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}
