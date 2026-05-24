export function hasPermission(permissions: readonly string[], key: string): boolean {
  return permissions.includes(key);
}

export function hasAnyPermission(permissions: readonly string[], keys: readonly string[]): boolean {
  return keys.some((key) => permissions.includes(key));
}

export function hasAllPermissions(permissions: readonly string[], keys: readonly string[]): boolean {
  return keys.every((key) => permissions.includes(key));
}
