import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import Database, { type Database as DB } from "better-sqlite3";
import type { WaitlistSubmissionParsed } from "./schema";

let cached: DB | null = null;

/**
 * Resolve a writable SQLite path. We avoid `:memory:` so manual moderation
 * survives restarts. In Docker the path should be on a mounted volume.
 */
export function resolveDbPath(): string {
  const raw = process.env["WAITLIST_DB_PATH"]?.trim() || "./data/waitlist.sqlite";
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

export function getDb(): DB {
  if (cached) return cached;
  const path = resolveDbPath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(MIGRATION);
  ensureColumn(db, "company", "TEXT");
  cached = db;
  return db;
}

const MIGRATION = `
CREATE TABLE IF NOT EXISTS waitlist_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  company TEXT,
  role TEXT NOT NULL,
  company_size TEXT NOT NULL,
  context TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'landing',
  ip_hash TEXT,
  user_agent TEXT,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewer_note TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_submissions_email_uniq
  ON waitlist_submissions (email);

CREATE INDEX IF NOT EXISTS waitlist_submissions_status_idx
  ON waitlist_submissions (status, created_at DESC);
`;

export interface InsertContext {
  ipHash: string | null;
  userAgent: string | null;
}

export interface InsertResult {
  status: "created" | "duplicate";
}

export function insertSubmission(
  input: WaitlistSubmissionParsed,
  ctx: InsertContext,
): InsertResult {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO waitlist_submissions
      (email, full_name, company, role, company_size, context, ip_hash, user_agent, consent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  try {
    stmt.run(
      input.email,
      input.fullName,
      input.company,
      input.role,
      input.companySize,
      input.context ?? null,
      ctx.ipHash,
      ctx.userAgent,
    );
    return { status: "created" };
  } catch (err: unknown) {
    if (isUniqueViolation(err)) return { status: "duplicate" };
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}

function ensureColumn(db: DB, column: string, definition: string): void {
  const columns = db.prepare("PRAGMA table_info(waitlist_submissions)").all() as Array<{
    name: string;
  }>;
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE waitlist_submissions ADD COLUMN ${column} ${definition}`);
  }
}

export interface CountByStatus {
  pending: number;
  approved: number;
  rejected: number;
}

export function counts(): CountByStatus {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT status, COUNT(*) AS n FROM waitlist_submissions GROUP BY status",
    )
    .all() as Array<{ status: string; n: number }>;
  const acc: CountByStatus = { pending: 0, approved: 0, rejected: 0 };
  for (const r of rows) {
    if (r.status === "pending" || r.status === "approved" || r.status === "rejected") {
      acc[r.status] = r.n;
    }
  }
  return acc;
}
