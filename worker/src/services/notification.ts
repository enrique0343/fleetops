import type { PrismaClient } from '@prisma/client';
import type { Bindings } from '../types';

// ─────────────────────────────────────────────
// Notification (Telegram) - Workers-native via fetch.
// Extensible: add more channels by following the same shape.
// ─────────────────────────────────────────────

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function sendTelegram(env: Bindings, message: string): Promise<SendResult> {
  const botToken = env.TELEGRAM_BOT_TOKEN || '';
  const chatId = env.TELEGRAM_CHAT_ID || '';
  if (!botToken || !chatId) {
    return { success: false, error: 'NOT_CONFIGURED' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
    const data = (await response.json()) as any;
    if (!data.ok) {
      return { success: false, error: data.description || 'Telegram API error' };
    }
    return { success: true, messageId: String(data.result.message_id) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// El mensaje va con parse_mode HTML: todo texto capturado por usuarios se escapa.
const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function formatTripMessage(trip: any): string {
  const duration = trip.durationMinutes
    ? `${Math.floor(trip.durationMinutes / 60)}h ${trip.durationMinutes % 60}m`
    : 'N/A';

  return `
🚛 <b>Viaje Finalizado</b>

👤 Conductor: ${esc(trip.driver?.fullName)}
🚗 Vehículo: ${esc(trip.vehicle?.plate)}
📍 Origen: ${esc(trip.originBranch?.name ?? 'Punto GPS de inicio')}
🎯 Destino: ${esc(trip.destination?.name)}
⏱ Duración: ${duration}
📅 Finalizado: ${trip.finishedAt ? new Date(trip.finishedAt).toLocaleString('es-SV', { timeZone: 'America/El_Salvador' }) : 'N/A'}
${trip.comment ? `💬 Comentario: ${esc(trip.comment)}` : ''}
  `.trim();
}

export async function notifyTripFinished(
  prisma: PrismaClient,
  env: Bindings,
  tripId: string
): Promise<SendResult> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      driver: { select: { fullName: true } },
      vehicle: { select: { plate: true } },
      originBranch: { select: { name: true } },
      destination: { select: { name: true } },
    },
  });

  if (!trip) return { success: false, error: 'Trip not found' };

  const message = formatTripMessage(trip);

  await prisma.trip.update({
    where: { id: tripId },
    data: { telegramLastAttemptAt: new Date() },
  });

  const result = await sendTelegram(env, message);

  await prisma.trip.update({
    where: { id: tripId },
    data: {
      telegramDeliveryStatus: result.success ? 'SENT' : result.error === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'FAILED',
      telegramLastResult: result.error || 'OK',
    },
  });

  await prisma.tripEvent.create({
    data: {
      tripId,
      type: result.success ? 'TELEGRAM_SENT' : 'TELEGRAM_FAILED',
      userId: (trip as any).driverId,
      deviceTimestamp: new Date(),
      comment: result.success ? 'Notificación enviada' : `Error: ${result.error}`,
    },
  });

  return result;
}
