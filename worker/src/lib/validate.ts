import { AppError } from './http';

// Lightweight replacements for express-validator used by the routes.

export function requireFields(body: Record<string, any>, fields: string[]): void {
  const missing = fields.filter((f) => {
    const v = body?.[f];
    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  });
  if (missing.length > 0) {
    throw new AppError('Datos inválidos: faltan campos requeridos (' + missing.join(', ') + ')');
  }
}

export function isEmail(value: unknown): boolean {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function positiveNumber(value: unknown): boolean {
  const n = typeof value === 'string' ? parseFloat(value) : (value as number);
  return typeof n === 'number' && !Number.isNaN(n) && n > 0;
}
