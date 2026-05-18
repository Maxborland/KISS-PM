import {
  isWorkspaceConfigFieldType,
  isWorkspaceConfigStatus,
  isWorkspaceConfigSystemKeyInput,
  isWorkspaceConfigTenantLabelInput,
  workspaceConfigDescriptionMaxLength
} from "@kiss-pm/domain";

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
  if (input.targetEntity !== "project") {
    errors.targetEntity = "Пока доступны только поля проекта.";
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
