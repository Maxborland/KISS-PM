import { connect as connectTcp, type Socket } from "node:net";
import { connect as connectTls, type TLSSocket } from "node:tls";

// Порт отправки писем для auth-флоу (сейчас только сброс пароля).
// Server runtime выбирает provider из env; тесты и локальный dev могут явно
// использовать in-memory provider без сетевых побочных эффектов.

export type PasswordResetEmailInput = {
  email: string;
  rawToken: string;
  resetUrl: string;
};

// Одна позиция дайджеста — заголовок/тело/раздел непрочитанного уведомления.
export type NotificationDigestItem = {
  title: string;
  body: string;
  route: string;
};

// Пакетное письмо-дайджест непрочитанных уведомлений одному получателю.
// Отправляется фоновой джобой notification.dispatch (см. jobHandlers.ts).
export type NotificationDigestEmailInput = {
  email: string;
  recipientName: string;
  items: NotificationDigestItem[];
};

// Письмо-приглашение сотрудника: одноразовый токен + ссылка на страницу
// задания пароля (/invite/accept). workspaceName/invitedByName — опциональный
// контекст для тела письма.
export type InvitationEmailInput = {
  email: string;
  rawToken: string;
  acceptUrl: string;
  workspaceName?: string;
  invitedByName?: string;
};

export type EmailProvider = {
  sendPasswordReset(input: PasswordResetEmailInput): Promise<void>;
  sendNotificationDigest(input: NotificationDigestEmailInput): Promise<void>;
  sendInvitation(input: InvitationEmailInput): Promise<void>;
};

export type InMemoryEmailProvider = EmailProvider & {
  readonly provider: "memory";
  // Последнее отправленное письмо сброса (для тестов/демо); null до первой отправки.
  lastPasswordReset: PasswordResetEmailInput | null;
  // Отправленные дайджесты уведомлений (для тестов/демо), в порядке отправки.
  notificationDigests: NotificationDigestEmailInput[];
  // Последнее отправленное приглашение (для тестов/демо); null до первой отправки.
  lastInvitation: InvitationEmailInput | null;
};

export type SmtpEmailProvider = EmailProvider & {
  readonly provider: "smtp";
};

export type SmtpEmailProviderRuntimeConfig = {
  provider: "smtp";
  host: string;
  port: number;
  from: string;
  envelopeFrom: string;
  ehloDomain: string;
  secure: boolean;
  requireTls: boolean;
  timeoutMs: number;
  username?: string;
  password?: string;
};

export type EmailProviderRuntimeConfig =
  | { provider: "memory" }
  | SmtpEmailProviderRuntimeConfig;

export function createInMemoryEmailProvider(): InMemoryEmailProvider {
  const provider: InMemoryEmailProvider = {
    provider: "memory",
    lastPasswordReset: null,
    notificationDigests: [],
    lastInvitation: null,
    async sendPasswordReset(input) {
      provider.lastPasswordReset = { ...input };
    },
    async sendNotificationDigest(input) {
      provider.notificationDigests.push({
        ...input,
        items: input.items.map((item) => ({ ...item }))
      });
    },
    async sendInvitation(input) {
      provider.lastInvitation = { ...input };
    }
  };
  return provider;
}

export function createEmailProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env
): EmailProvider {
  const config = readEmailProviderRuntimeConfig(env);
  if (config.provider === "memory") return createInMemoryEmailProvider();
  return createSmtpEmailProvider(config);
}

export function readEmailProviderRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): EmailProviderRuntimeConfig {
  const production = env.NODE_ENV === "production";
  const provider = parseEmailProviderKind(env.KISS_PM_EMAIL_PROVIDER, production);
  if (provider === "memory") return { provider };

  const secure = parseBooleanEnv(env.KISS_PM_SMTP_SECURE, false, "kiss_pm_smtp_secure_invalid");
  const host = normalizeSmtpHost(requireEnv(env, "KISS_PM_SMTP_HOST"));
  const from = requireEnv(env, "KISS_PM_SMTP_FROM");
  const envelopeFrom = extractEmailAddress(from, "smtp_from_invalid");
  const username = optionalTrimmedEnv(env.KISS_PM_SMTP_USERNAME);
  const password = optionalTrimmedEnv(env.KISS_PM_SMTP_PASSWORD);
  if ((username && !password) || (!username && password)) {
    throw new Error("smtp_auth_misconfigured");
  }

  const config: SmtpEmailProviderRuntimeConfig = {
    provider: "smtp",
    host,
    port: parseSmtpPort(env.KISS_PM_SMTP_PORT, secure ? 465 : 587),
    from,
    envelopeFrom,
    ehloDomain: normalizeEhloDomain(env.KISS_PM_SMTP_EHLO_DOMAIN),
    secure,
    requireTls: parseBooleanEnv(
      env.KISS_PM_SMTP_REQUIRE_TLS,
      production,
      "kiss_pm_smtp_require_tls_invalid"
    ),
    timeoutMs: parseBoundedIntegerEnv(
      env.KISS_PM_SMTP_TIMEOUT_MS,
      10_000,
      1_000,
      60_000,
      "kiss_pm_smtp_timeout_ms_invalid"
    )
  };
  if (username && password) {
    config.username = username;
    config.password = password;
  }
  return config;
}

export function createSmtpEmailProvider(
  config: SmtpEmailProviderRuntimeConfig
): SmtpEmailProvider {
  return {
    provider: "smtp",
    async sendPasswordReset(input) {
      await sendSmtpMessage(config, {
        from: config.from,
        envelopeFrom: config.envelopeFrom,
        to: input.email,
        subject: "KISS PM password reset",
        body: [
          "A password reset was requested for your KISS PM workspace account.",
          "",
          `Reset link: ${input.resetUrl}`,
          `Reset token: ${input.rawToken}`,
          "",
          "If you did not request this, ignore this message."
        ].join("\n")
      });
    },
    async sendNotificationDigest(input) {
      if (input.items.length === 0) return;
      await sendSmtpMessage(config, {
        from: config.from,
        envelopeFrom: config.envelopeFrom,
        to: input.email,
        subject: `KISS PM · новые уведомления (${input.items.length})`,
        body: formatNotificationDigestBody(input)
      });
    },
    async sendInvitation(input) {
      await sendSmtpMessage(config, {
        from: config.from,
        envelopeFrom: config.envelopeFrom,
        to: input.email,
        subject: input.workspaceName
          ? `Приглашение в рабочее пространство «${input.workspaceName}» — KISS PM`
          : "Приглашение в рабочее пространство KISS PM",
        body: formatInvitationBody(input)
      });
    }
  };
}

// Тело письма-приглашения: ссылка на страницу задания пароля + сам токен
// (на случай, если ссылка не откроется). Тексты русские (user-facing).
function formatInvitationBody(input: InvitationEmailInput): string {
  const workspace = input.workspaceName ? `«${input.workspaceName}»` : "KISS PM";
  const inviter = input.invitedByName ? `${input.invitedByName} ` : "";
  return [
    "Здравствуйте!",
    "",
    `${inviter}приглашает вас в рабочее пространство ${workspace} в KISS PM.`,
    "Чтобы принять приглашение, перейдите по ссылке и задайте пароль:",
    "",
    input.acceptUrl,
    "",
    `Код приглашения: ${input.rawToken}`,
    "",
    "Ссылка действует 60 минут. Если вы не ожидали это приглашение — просто проигнорируйте письмо."
  ].join("\n");
}

function formatNotificationDigestBody(input: NotificationDigestEmailInput): string {
  const lines = [
    `Здравствуйте, ${input.recipientName}!`,
    "",
    "У вас есть новые уведомления в KISS PM:",
    ""
  ];
  for (const item of input.items) {
    lines.push(`• ${item.title}`);
    if (item.body.trim()) lines.push(`  ${item.body}`);
    if (item.route.trim()) lines.push(`  Раздел: ${item.route}`);
    lines.push("");
  }
  lines.push("Откройте KISS PM, чтобы просмотреть и ответить.");
  return lines.join("\n");
}

function parseEmailProviderKind(
  value: string | undefined,
  production: boolean
): EmailProviderRuntimeConfig["provider"] {
  if (value === undefined || value.trim() === "") return production ? "smtp" : "memory";
  if (value === "smtp") return "smtp";
  if (value === "memory" || value === "in-memory") {
    if (production) throw new Error("email_provider_memory_forbidden_in_production");
    return "memory";
  }
  throw new Error("invalid_email_provider");
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value || value.trim() === "") throw new Error(`${key.toLowerCase()}_required`);
  return value;
}

function optionalTrimmedEnv(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  return value.trim();
}

function normalizeSmtpHost(value: string): string {
  const host = value.trim();
  if (
    host.length < 1 ||
    host.length > 253 ||
    host.includes("://") ||
    host.includes("/") ||
    host.includes("@") ||
    /\s/.test(host)
  ) {
    throw new Error("smtp_host_invalid");
  }
  return host;
}

function parseSmtpPort(value: string | undefined, defaultPort: number): number {
  if (value === undefined || value.trim() === "") return defaultPort;
  if (!/^[1-9][0-9]{0,4}$/.test(value)) throw new Error("smtp_port_invalid");
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535) throw new Error("smtp_port_invalid");
  return port;
}

function parseBooleanEnv(
  value: string | undefined,
  defaultValue: boolean,
  errorCode: string
): boolean {
  if (value === undefined || value.trim() === "") return defaultValue;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(errorCode);
}

function parseBoundedIntegerEnv(
  value: string | undefined,
  defaultValue: number,
  min: number,
  max: number,
  errorCode: string
): number {
  if (value === undefined || value.trim() === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(errorCode);
  }
  return parsed;
}

function normalizeEhloDomain(value: string | undefined): string {
  const domain = value?.trim() || "kiss-pm.local";
  if (domain.length > 253 || domain.includes("://") || /\s/.test(domain)) {
    throw new Error("kiss_pm_smtp_ehlo_domain_invalid");
  }
  return domain;
}

function extractEmailAddress(value: string, errorCode: string): string {
  const trimmed = value.trim();
  const angleMatch = trimmed.match(/<([^<>]+)>$/);
  const address = (angleMatch?.[1] ?? trimmed).trim();
  if (!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(address)) {
    throw new Error(errorCode);
  }
  return address;
}

type SmtpSocket = Socket | TLSSocket;

type SmtpMessage = {
  from: string;
  envelopeFrom: string;
  to: string;
  subject: string;
  body: string;
};

async function sendSmtpMessage(
  config: SmtpEmailProviderRuntimeConfig,
  message: SmtpMessage
): Promise<void> {
  let socket = await openSmtpSocket(config);
  let reader = createSmtpReader(socket);

  try {
    expectSmtpCode(await reader.next(), [220]);
    let tlsActive = config.secure;
    let capabilities = await sendEhlo(socket, reader, config.ehloDomain);
    if (!tlsActive && capabilities.has("STARTTLS")) {
      await sendCommand(socket, reader, "STARTTLS", [220]);
      socket = await upgradeToTls(socket, config);
      reader = createSmtpReader(socket);
      tlsActive = true;
      capabilities = await sendEhlo(socket, reader, config.ehloDomain);
    }
    if (config.requireTls && !tlsActive) {
      throw new Error("smtp_starttls_required");
    }
    if (config.username && config.password) {
      const auth = Buffer.from(`\0${config.username}\0${config.password}`).toString("base64");
      await sendCommand(socket, reader, `AUTH PLAIN ${auth}`, [235]);
    }

    await sendCommand(socket, reader, `MAIL FROM:<${message.envelopeFrom}>`, [250]);
    await sendCommand(
      socket,
      reader,
      `RCPT TO:<${extractEmailAddress(message.to, "smtp_recipient_invalid")}>`,
      [250, 251]
    );
    await sendCommand(socket, reader, "DATA", [354]);
    await writeSocket(socket, `${formatMessage(message)}\r\n.\r\n`);
    expectSmtpCode(await reader.next(), [250]);
    await sendCommand(socket, reader, "QUIT", [221]).catch(() => undefined);
  } finally {
    socket.destroy();
  }
}

function openSmtpSocket(config: SmtpEmailProviderRuntimeConfig): Promise<SmtpSocket> {
  return new Promise((resolve, reject) => {
    const socket = config.secure
      ? connectTls({ host: config.host, port: config.port, servername: config.host })
      : connectTcp({ host: config.host, port: config.port });
    const eventName = config.secure ? "secureConnect" : "connect";
    const timer = setTimeout(() => {
      socket.destroy(new Error("smtp_connect_timeout"));
    }, config.timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      socket.off(eventName, onConnect);
      socket.off("error", onError);
    };
    const onConnect = () => {
      cleanup();
      socket.setTimeout(config.timeoutMs, () => {
        socket.destroy(new Error("smtp_timeout"));
      });
      resolve(socket);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    socket.once(eventName, onConnect);
    socket.once("error", onError);
  });
}

function upgradeToTls(
  socket: SmtpSocket,
  config: SmtpEmailProviderRuntimeConfig
): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    socket.removeAllListeners("data");
    const tlsSocket = connectTls({ socket, servername: config.host });
    const timer = setTimeout(() => {
      tlsSocket.destroy(new Error("smtp_starttls_timeout"));
    }, config.timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      tlsSocket.off("secureConnect", onSecureConnect);
      tlsSocket.off("error", onError);
    };
    const onSecureConnect = () => {
      cleanup();
      tlsSocket.setTimeout(config.timeoutMs, () => {
        tlsSocket.destroy(new Error("smtp_timeout"));
      });
      resolve(tlsSocket);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    tlsSocket.once("secureConnect", onSecureConnect);
    tlsSocket.once("error", onError);
  });
}

function createSmtpReader(socket: SmtpSocket) {
  let buffer = "";
  let current: string[] = [];
  const responses: string[][] = [];
  const waiters: Array<{
    resolve: (response: string[]) => void;
    reject: (error: Error) => void;
  }> = [];

  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffer += String(chunk);
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);
      current.push(line);
      if (/^[0-9]{3} /.test(line)) {
        responses.push(current);
        current = [];
      }
      newlineIndex = buffer.indexOf("\n");
    }
    flushSmtpWaiters(responses, waiters);
  });
  socket.on("error", (error) => {
    const pending = waiters.splice(0);
    for (const waiter of pending) waiter.reject(error);
  });

  return {
    next() {
      const response = responses.shift();
      if (response) return Promise.resolve(response);
      return new Promise<string[]>((resolve, reject) => {
        waiters.push({ resolve, reject });
      });
    }
  };
}

function flushSmtpWaiters(
  responses: string[][],
  waiters: Array<{ resolve: (response: string[]) => void }>
) {
  while (responses.length > 0 && waiters.length > 0) {
    const response = responses.shift();
    const waiter = waiters.shift();
    if (response && waiter) waiter.resolve(response);
  }
}

async function sendEhlo(
  socket: SmtpSocket,
  reader: ReturnType<typeof createSmtpReader>,
  ehloDomain: string
): Promise<Set<string>> {
  const response = await sendCommand(socket, reader, `EHLO ${ehloDomain}`, [250]);
  return parseEhloCapabilities(response);
}

async function sendCommand(
  socket: SmtpSocket,
  reader: ReturnType<typeof createSmtpReader>,
  command: string,
  expectedCodes: number[]
): Promise<string[]> {
  await writeSocket(socket, `${command}\r\n`);
  const response = await reader.next();
  expectSmtpCode(response, expectedCodes);
  return response;
}

function writeSocket(socket: SmtpSocket, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(data, (error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function expectSmtpCode(response: string[], expectedCodes: number[]): void {
  const line = response[0] ?? "";
  const code = Number(line.slice(0, 3));
  if (!expectedCodes.includes(code)) {
    throw new Error("smtp_unexpected_response");
  }
}

function parseEhloCapabilities(response: string[]): Set<string> {
  const capabilities = new Set<string>();
  for (const line of response.slice(1)) {
    const capability = line.replace(/^[0-9]{3}[- ]/, "").split(/\s+/)[0];
    if (capability) capabilities.add(capability.toUpperCase());
  }
  return capabilities;
}

function formatMessage(message: SmtpMessage): string {
  const headers = [
    `From: ${sanitizeHeader(message.from)}`,
    `To: ${sanitizeHeader(message.to)}`,
    `Subject: ${sanitizeHeader(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit"
  ];
  return `${headers.join("\r\n")}\r\n\r\n${dotStuff(message.body)}`;
}

function sanitizeHeader(value: string): string {
  const sanitized = value.trim();
  if (!sanitized || /[\r\n]/.test(sanitized)) throw new Error("smtp_header_invalid");
  return sanitized;
}

function dotStuff(value: string): string {
  return value
    .replace(/\r?\n/g, "\r\n")
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}
