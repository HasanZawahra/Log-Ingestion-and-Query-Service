export function encodeAttributeKv(key: string, value: string): string {
  // Pack the key and value into a stable string for containment checks.
  return `${key.length}:${key}=${value}`;
}
