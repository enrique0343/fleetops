import type { Context } from 'hono';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

// Centralised error mapping, mirroring the original Express errorHandler.
export function handleError(err: Error, c: Context): Response {
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message);

  if (err instanceof AppError) {
    return c.json({ success: false, error: err.message }, err.statusCode as any);
  }

  if (err.message.includes('Unique constraint')) {
    return c.json({ success: false, error: 'Ya existe un registro con esos datos' }, 409);
  }

  if (
    err.message.includes('Record to update not found') ||
    err.message.includes('No record was found') ||
    err.message.includes('to delete does not exist')
  ) {
    return c.json({ success: false, error: 'Registro no encontrado' }, 404);
  }

  return c.json({ success: false, error: 'Error interno del servidor' }, 500);
}
