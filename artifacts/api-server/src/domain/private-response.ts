const PRIVATE_RESPONSE_KEYS = new Set(["ownerKey"]);

export function stripPrivateResponseFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPrivateResponseFields);
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !PRIVATE_RESPONSE_KEYS.has(key))
    .map(([key, child]) => [key, stripPrivateResponseFields(child)] as const);
  return Object.fromEntries(entries);
}
