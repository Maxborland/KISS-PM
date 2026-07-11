import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { connect as connectTls, type TLSSocket } from "node:tls";

import {
  createEmailProviderFromEnv,
  readEmailProviderRuntimeConfig
} from "../apps/api/src/emailProvider";

type ImapCommandResult = {
  lines: string[];
  status: "OK" | "NO" | "BAD" | "UNKNOWN";
};

type MailFolderCheck = {
  folder: string;
  uidCount: number;
};

type DiagnosticResult = {
  id: string;
  generatedAt: string;
  linkedRiskZones: string[];
  scope: string;
  secretsPolicy: string;
  status: "pass" | "partial" | "fail";
  provider: {
    selected: "smtp";
    smtp: {
      acceptedByProviderPath: boolean;
      host: string;
      port: number;
      secure: boolean;
      requireTls: boolean;
    };
    recipientSource: "KISS_PM_MAIL_READBACK_TO" | "KISS_PM_IMAP_USERNAME" | "KISS_PM_POP3_USERNAME" | "KISS_PM_SMTP_USERNAME";
  };
  readback: {
    waitMs: number;
    imap: { status: "pass" | "fail"; host: string; port: number; found: boolean; folders?: MailFolderCheck[]; folder?: string; error?: string };
    pop3: { status: "pass" | "fail"; host: string; port: number; found: boolean; recentCount?: number; messageId?: string; error?: string };
  };
  coverageImpact: {
    "RISK-AUTH-EMAIL-RESET-HAPPY-PATH": string;
  };
};



function loadDotEnvLocal(path = ".env.local") {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    if (process.env[key] === undefined) {
      process.env[key] = stripOptionalQuotes(line.slice(index + 1).trim());
    }
  }
}

function stripOptionalQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function requireDiagnosticEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key.toLowerCase()}_required`);
  return value;
}

function resolveRecipient(): { email: string; source: DiagnosticResult["provider"]["recipientSource"] } {
  const candidates = [
    ["KISS_PM_MAIL_READBACK_TO", process.env.KISS_PM_MAIL_READBACK_TO],
    ["KISS_PM_IMAP_USERNAME", process.env.KISS_PM_IMAP_USERNAME],
    ["KISS_PM_POP3_USERNAME", process.env.KISS_PM_POP3_USERNAME],
    ["KISS_PM_SMTP_USERNAME", process.env.KISS_PM_SMTP_USERNAME]
  ] as const;
  for (const [source, value] of candidates) {
    if (value?.trim()) return { email: value.trim(), source };
  }
  throw new Error("kiss_pm_mail_readback_recipient_required");
}

async function imapCommand(socket: TLSSocket, tag: string, command: string): Promise<ImapCommandResult> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => done(new Error(`imap_timeout_${commandName(command)}`)), 20_000);
    const done = (error?: Error) => {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
      if (error) reject(error);
      else {
        const lines = buffer.split(/\r?\n/).filter(Boolean);
        const status = (lines
          .find((line) => new RegExp(`^${tag} (OK|NO|BAD)\\b`, "i").test(line))
          ?.match(new RegExp(`^${tag} (OK|NO|BAD)\\b`, "i"))?.[1]
          ?.toUpperCase() ?? "UNKNOWN") as ImapCommandResult["status"];
        resolve({ lines, status });
      }
    };
    const onError = (error: Error) => done(error);
    const onData = (chunk: Buffer | string) => {
      buffer += String(chunk);
      if (new RegExp(`(^|\\r?\\n)${tag} (OK|NO|BAD)\\b`, "i").test(buffer)) done();
    };
    socket.on("data", onData);
    socket.on("error", onError);
    socket.write(`${tag} ${command}\r\n`);
  });
}

function commandName(command: string): string {
  return command.split(/\s+/, 1)[0]?.toLowerCase() || "command";
}

function parseMailboxNames(listResponse: string[]): string[] {
  return listResponse
    .filter((line) => line.startsWith("* LIST "))
    .map((line) => {
      const quoted = [...line.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
      const afterDelimiter = line.replace(/^\* LIST \([^)]*\)\s+"[^"]*"\s+/i, "").trim();
      return afterDelimiter.replace(/^"|"$/g, "") || quoted.at(-1) || "INBOX";
    })
    .filter(Boolean);
}

function quoteImap(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function connectTlsSocket(host: string, port: number): Promise<TLSSocket> {
  const socket = connectTls({ host, port, servername: host });
  socket.setEncoding("utf8");
  await new Promise<void>((resolve, reject) => {
    socket.once("secureConnect", () => resolve());
    socket.once("error", reject);
  });
  return socket;
}

async function imapSearchToken(token: string): Promise<DiagnosticResult["readback"]["imap"]> {
  const host = requireDiagnosticEnv("KISS_PM_IMAP_HOST");
  const port = Number(process.env.KISS_PM_IMAP_PORT || "993");
  const user = requireDiagnosticEnv("KISS_PM_IMAP_USERNAME");
  const pass = requireDiagnosticEnv("KISS_PM_IMAP_PASSWORD");
  const socket = await connectTlsSocket(host, port);
  try {
    await new Promise<void>((resolve) => socket.once("data", () => resolve()));
    const login = await imapCommand(socket, "a1", `LOGIN ${quoteImap(user)} ${quoteImap(pass)}`);
    if (login.status !== "OK") throw new Error(`imap_login_${login.status.toLowerCase()}`);
    const list = await imapCommand(socket, "a2", 'LIST "" "*"');
    if (list.status !== "OK") throw new Error(`imap_list_${list.status.toLowerCase()}`);
    const folders = parseMailboxNames(list.lines);
    const checked: MailFolderCheck[] = [];
    for (const folder of folders) {
      const selected = await imapCommand(socket, "sel", `SELECT ${quoteImap(folder)}`).catch(() => null);
      if (!selected || selected.status !== "OK") continue;
      const search = await imapCommand(socket, "sea", "UID SEARCH ALL");
      if (search.status !== "OK") continue;
      const ids = (search.lines.join("\n").match(/\* SEARCH ([0-9 ]*)/)?.[1] ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(-50);
      checked.push({ folder, uidCount: ids.length });
      if (ids.length === 0) continue;
      const fetched = await imapCommand(socket, "fet", `UID FETCH ${ids.join(",")} BODY.PEEK[]`);
      if (fetched.lines.join("\n").includes(token)) {
        return { status: "pass", host, port, found: true, folder, folders: checked };
      }
    }
    return { status: "fail", host, port, found: false, folders: checked };
  } finally {
    socket.destroy();
  }
}

async function pop3Command(socket: TLSSocket, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const multiline = /^(LIST|RETR|TOP)\b/i.test(command);
    const timer = setTimeout(() => done(new Error(`pop3_timeout_${commandName(command)}`)), 20_000);
    const done = (error?: Error) => {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
      if (error) reject(error);
      else resolve(buffer);
    };
    const onError = (error: Error) => done(error);
    const onData = (chunk: Buffer | string) => {
      buffer += String(chunk);
      if (buffer.startsWith("-ERR")) done(new Error(`pop3_${commandName(command)}_failed`));
      else if (multiline ? /\r?\n\.\r?\n$/.test(buffer) : /\r?\n$/.test(buffer)) done();
    };
    socket.on("data", onData);
    socket.on("error", onError);
    socket.write(`${command}\r\n`);
  });
}

async function pop3SearchToken(token: string): Promise<DiagnosticResult["readback"]["pop3"]> {
  const host = requireDiagnosticEnv("KISS_PM_POP3_HOST");
  const port = Number(process.env.KISS_PM_POP3_PORT || "995");
  const user = requireDiagnosticEnv("KISS_PM_POP3_USERNAME");
  const pass = requireDiagnosticEnv("KISS_PM_POP3_PASSWORD");
  const socket = await connectTlsSocket(host, port);
  try {
    await new Promise<void>((resolve) => socket.once("data", () => resolve()));
    await pop3Command(socket, `USER ${user}`);
    await pop3Command(socket, `PASS ${pass}`);
    const list = await pop3Command(socket, "LIST");
    const ids = [...list.matchAll(/^([0-9]+) /gm)].map((match) => match[1]).slice(-25);
    for (const id of ids) {
      const body = await pop3Command(socket, `RETR ${id}`);
      if (body.includes(token)) return { status: "pass", host, port, found: true, messageId: id, recentCount: ids.length };
    }
    await pop3Command(socket, "QUIT").catch(() => undefined);
    return { status: "fail", host, port, found: false, recentCount: ids.length };
  } finally {
    socket.destroy();
  }
}

function redactError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown_error";
  return error.message.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<email>");
}

function getOutPath(): string | undefined {
  const index = process.argv.indexOf("--out");
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  loadDotEnvLocal();
  const waitMs = Number(process.env.KISS_PM_MAIL_READBACK_WAIT_MS || "30000");
  const config = readEmailProviderRuntimeConfig(process.env);
  if (config.provider !== "smtp") throw new Error("smtp_provider_not_selected");
  const recipient = resolveRecipient();
  const token = `reset-readback-${randomUUID().replace(/-/g, "")}`;

  await createEmailProviderFromEnv().sendPasswordReset({
    email: recipient.email,
    rawToken: token,
    resetUrl: `https://kisspm.app/password-reset/confirm?token=${token}`
  });

  await new Promise((resolve) => setTimeout(resolve, waitMs));

  const imap = await imapSearchToken(token).catch((error) => ({
    status: "fail" as const,
    host: process.env.KISS_PM_IMAP_HOST || "<unset>",
    port: Number(process.env.KISS_PM_IMAP_PORT || "993"),
    found: false,
    error: redactError(error)
  }));
  const pop3 = await pop3SearchToken(token).catch((error) => ({
    status: "fail" as const,
    host: process.env.KISS_PM_POP3_HOST || "<unset>",
    port: Number(process.env.KISS_PM_POP3_PORT || "995"),
    found: false,
    error: redactError(error)
  }));
  const result: DiagnosticResult = {
    id: "RISK-AUTH-EMAIL-RESET-PROVIDER-READBACK-DIAGNOSTIC",
    generatedAt: new Date().toISOString(),
    linkedRiskZones: ["RISK-AUTH-EMAIL-RESET-HAPPY-PATH"],
    scope: "Provider-level SMTP send plus IMAP/POP3 mailbox readback for password reset email marker. This does not exercise browser confirm/login.",
    secretsPolicy: "Loaded .env.local/user env values are not emitted. Recipient, credentials, and reset token are intentionally omitted.",
    status: imap.found || pop3.found ? "pass" : "partial",
    provider: {
      selected: "smtp",
      smtp: {
        acceptedByProviderPath: true,
        host: config.host,
        port: config.port,
        secure: config.secure,
        requireTls: config.requireTls
      },
      recipientSource: recipient.source
    },
    readback: { waitMs, imap, pop3 },
    coverageImpact: {
      "RISK-AUTH-EMAIL-RESET-HAPPY-PATH": imap.found || pop3.found
        ? "Provider delivery/readback is proven for this mailbox; route/browser confirm still needs a full browser reset run if required."
        : "SMTP provider accepted the reset email, but mailbox readback did not find it; full live reset via email remains open."
    }
  };

  const output = `${JSON.stringify(result, null, 2)}\n`;
  const outPath = getOutPath();
  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, output, "utf8");
  }
  process.stdout.write(output);
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "fail", error: redactError(error) }, null, 2));
  process.exitCode = 1;
});
