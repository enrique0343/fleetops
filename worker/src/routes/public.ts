import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { AppError } from '../lib/http';
import { requireFields, isEmail } from '../lib/validate';
import { RequestService } from '../services/requestService';

// ─────────────────────────────────────────────
// Formulario público de solicitudes (sin cuenta).
// El acceso se controla con un token en el enlace:
//   /api/public/...?token=<PUBLIC_FORM_TOKEN>
// El token se configura como secret del Worker (wrangler secret put).
// ─────────────────────────────────────────────

const pub = new Hono<AppEnv>();

function checkToken(c: any) {
  const expected = c.env.PUBLIC_FORM_TOKEN;
  if (!expected) {
    throw new AppError('El formulario público no está configurado. Define PUBLIC_FORM_TOKEN.', 503);
  }
  const provided = c.req.query('token') || c.req.header('x-form-token') || '';
  if (provided !== expected) {
    throw new AppError('Enlace inválido o expirado.', 403);
  }
}

// Catálogo mínimo que necesita el formulario (ubicaciones activas).
pub.get('/bootstrap', async (c) => {
  checkToken(c);
  const locations = await c.get('prisma').location.findMany({
    where: { isActive: true },
    select: { id: true, name: true, type: true },
    orderBy: { name: 'asc' },
  });
  return c.json({ success: true, data: { locations } });
});

// Crear una solicitud desde el formulario público (queda PENDING).
pub.post('/requests', async (c) => {
  checkToken(c);
  const body = await c.req.json().catch(() => ({}));
  // El correo institucional es obligatorio: es la trazabilidad de quién solicita.
  requireFields(body, ['requesterName', 'requesterEmail', 'originId', 'destinationId', 'scheduledAt']);
  if (!isEmail(body.requesterEmail)) {
    throw new AppError('Ingresa un correo institucional válido');
  }

  const svc = new RequestService(c.get('prisma'));
  const data = await svc.create({
    serviceType: body.serviceType,
    // El público no puede auto-asignarse prioridad de emergencia.
    priority: body.serviceType === 'AMBULANCE' ? 'URGENT' : 'SCHEDULED',
    requesterId: undefined, // solicitante externo sin cuenta
    requesterName: body.requesterName,
    requesterEmail: body.requesterEmail,
    requesterPhone: body.requesterPhone,
    requesterDept: body.requesterDept,
    originId: body.originId,
    destinationId: body.destinationId,
    scheduledAt: new Date(body.scheduledAt),
    passengerCount: body.passengerCount,
    reason: body.reason,
    patientName: body.patientName,
    patientCondition: body.patientCondition,
    requiresStretcher: body.requiresStretcher,
    requiresOxygen: body.requiresOxygen,
    clinicalNotes: body.clinicalNotes,
  });

  // Solo devolvemos lo justo para el acuse (código y estado).
  return c.json({ success: true, data: { code: data.code, status: data.status } }, 201);
});

export default pub;
