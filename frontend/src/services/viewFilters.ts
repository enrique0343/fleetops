/** Convert date inputs to inclusive instants in the viewer's local time zone. */
export function dateBoundary(value: string, endOfDay = false): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0).toISOString();
}

export function updateTripFilter(current: URLSearchParams, key: string, value: string): URLSearchParams {
  const next = new URLSearchParams(current);
  if (value) next.set(key, value); else next.delete(key);
  if (key !== 'page') next.set('page', '1');
  return next;
}
