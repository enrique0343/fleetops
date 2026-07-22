// SQLite/D1 has no Json scalar, so JSON values are stored as TEXT.
// These helpers encode on write and decode on read.

export function toJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

export function fromJson<T = unknown>(value: unknown): T | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}
