// Human-readable folio generator, e.g. REQ-2026-0A3F9C.
// Random suffix avoids needing a DB sequence (D1-friendly) while staying
// short and legible. Collisions are guarded by a UNIQUE constraint upstream.

export function makeCode(prefix: string): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `${prefix}-${year}-${suffix}`;
}
