export function createClientId(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}