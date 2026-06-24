import type { Meta, StoryObj } from "@storybook/react";

import { ResetRequestSurface } from "@/auth/password-reset/reset-request-surface";
import { ResetConfirmSurface } from "@/auth/password-reset/reset-confirm-surface";

/**
 * Auth — поверхности «Сброс пароля» (БОЕВОЙ контракт password-reset/{request,confirm},
 * apps/api/src/authRegistrationRoutes.ts; мок зеркалит). Обе работают через настоящий
 * createAuthClient + in-memory mock (переключение на боевой API = смена apiOrigin).
 *
 * Запрос: anti-enumeration — всегда нейтральное «Если адрес зарегистрирован — мы
 * отправили инструкции». Письма нет → токен показывается под плашкой «Демо» (демо-замена;
 * в боевом ответе только {status:"ok"}, токен уходит письмом через EmailProvider).
 * Подтверждение: токен 64-hex + новый пароль → POST /password-reset/confirm.
 * Демо-токены: валидный = "a"×64, истёкший = "b"×64, использованный = "c"×64.
 */
const meta: Meta = {
  title: "Auth/Password Reset",
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

/* ---- Демо-токены сброса (сид mock-auth-backend): см. реквизиты в задаче. ---- */
const VALID_TOKEN = "a".repeat(64); // валидный → confirm: успех
const EXPIRED_TOKEN = "b".repeat(64); // истёкший → token_expired
const USED_TOKEN = "c".repeat(64); // использованный → reset_token_used

/* ============================================================
   Стори «Запрос»: вводим зарегистрированный email (admin@kiss-pm.local) →
   нейтральное подтверждение + devToken под плашкой «Демо» + переход к
   подтверждению. Неверный формат email → FormError (invalid_email).
   ============================================================ */
type RequestStory = StoryObj<typeof ResetRequestSurface>;
export const Request: RequestStory = {
  name: "Запрос",
  render: () => <ResetRequestSurface />
};

/* ============================================================
   Стори «Подтверждение»: поле токена + новый пароль. Предзаполнен ВАЛИДНЫЙ
   токен ("a"×64) → submit с паролем ≥8 даёт успех («Пароль изменён, войдите»).
   Для проверки ошибок вставьте истёкший ("b"×64 → token_expired) или
   использованный ("c"×64 → reset_token_used); короткий пароль → weak_password;
   произвольный токен → invalid_reset_token.
   ============================================================ */
type ConfirmStory = StoryObj<typeof ResetConfirmSurface>;
export const Confirm: ConfirmStory = {
  name: "Подтверждение",
  args: { token: VALID_TOKEN },
  argTypes: {
    token: {
      control: "select",
      options: [VALID_TOKEN, EXPIRED_TOKEN, USED_TOKEN],
      // Подписи для удобства: какой исход даёт каждый токен.
      labels: {
        [VALID_TOKEN]: 'Валидный ("a"×64) → успех',
        [EXPIRED_TOKEN]: 'Истёкший ("b"×64) → token_expired',
        [USED_TOKEN]: 'Использованный ("c"×64) → reset_token_used'
      }
    }
  },
  render: (args) => <ResetConfirmSurface {...args} />
};
