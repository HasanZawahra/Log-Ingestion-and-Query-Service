export function encodeAttributeKv(key: string, value: string): string {
  return `${key.length}:${key}=${value}`;
}
