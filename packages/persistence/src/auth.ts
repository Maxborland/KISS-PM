import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const keyLength = 64;

export type PasswordHashRecord = {
  passwordHash: string;
  passwordSalt: string;
};

export function hashPassword(password: string): PasswordHashRecord {
  const passwordSalt = randomBytes(16).toString("hex");
  const passwordHash = scryptSync(password, passwordSalt, keyLength).toString(
    "hex"
  );

  return {
    passwordHash,
    passwordSalt
  };
}

export function verifyPassword(input: {
  password: string;
  passwordHash: string;
  passwordSalt: string;
}): boolean {
  const expected = Buffer.from(input.passwordHash, "hex");
  const actual = scryptSync(input.password, input.passwordSalt, keyLength);

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export function hashSessionToken(token: string): string {
  return scryptSync(token, "kiss-pm-session", keyLength).toString("hex");
}
