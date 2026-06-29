// Порт отправки писем для auth-флоу (сейчас только сброс пароля).
// Боевая реализация (SMTP/SES/…) подключается через ту же сигнатуру в server.ts.
// По умолчанию используем in-memory no-op: писем никуда не шлём, но запоминаем
// «последнее» отправленное письмо — это нужно тестам и демо-сценариям Storybook.

export type PasswordResetEmailInput = {
  email: string;
  rawToken: string;
  resetUrl: string;
};

export type EmailProvider = {
  sendPasswordReset(input: PasswordResetEmailInput): Promise<void>;
};

export type InMemoryEmailProvider = EmailProvider & {
  // Последнее отправленное письмо сброса (для тестов/демо); null до первой отправки.
  lastPasswordReset: PasswordResetEmailInput | null;
};

export function createInMemoryEmailProvider(): InMemoryEmailProvider {
  const provider: InMemoryEmailProvider = {
    lastPasswordReset: null,
    async sendPasswordReset(input) {
      provider.lastPasswordReset = { ...input };
    }
  };
  return provider;
}
