// ─────────────────────────────────────────────────────────
// Notification Adapter Pattern
// ─────────────────────────────────────────────────────────

import { NotificationPayload, NotificationResult } from '../../types';

export interface NotificationAdapter {
  sendRaw(message: string): Promise<NotificationResult>;
  isConfigured(): boolean;
}

// ─────────────────────────────────────────────────────────
// Telegram Adapter
// ─────────────────────────────────────────────────────────

export class TelegramAdapter implements NotificationAdapter {
  private botToken: string;
  private chatId: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
  }

  isConfigured(): boolean {
    return Boolean(this.botToken && this.chatId);
  }

  async sendRaw(message: string): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        channel: 'telegram',
        error: 'Telegram no configurado (TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID vacíos)',
      };
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      const data = await response.json() as { ok: boolean; result?: { message_id: number }; description?: string };

      if (data.ok) {
        return { success: true, channel: 'telegram', messageId: String(data.result?.message_id) };
      } else {
        return { success: false, channel: 'telegram', error: data.description || 'Error desconocido de Telegram API' };
      }
    } catch (err) {
      return { success: false, channel: 'telegram', error: err instanceof Error ? err.message : 'Error de red' };
    }
  }
}

// ─────────────────────────────────────────────────────────
// Message Builders
// ─────────────────────────────────────────────────────────

const tz = { timeZone: 'America/El_Salvador', day: '2-digit' as const, month: '2-digit' as const, year: 'numeric' as const, hour: '2-digit' as const, minute: '2-digit' as const };
const fmtDate = (d: Date) => d.toLocaleString('es-SV', tz);
const fmtTime = (d: Date) => d.toLocaleString('es-SV', { timeZone: 'America/El_Salvador', hour: '2-digit', minute: '2-digit' });
const fmtDur = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return h > 0 ? `${h}h ${m}min` : `${m}min`; };
const tripId = (id: string) => `<code>${id.substring(0, 8)}</code>`;

export function buildTripStartedMessage(p: {
  tripId: string; driverName: string; vehiclePlate: string;
  origin: string; destination: string; startedAt: Date; comment?: string | null;
}): string {
  return [
    '🚀 <b>Viaje Iniciado</b>',
    '',
    `👤 <b>Motorista:</b> ${p.driverName}`,
    `🚙 <b>Vehículo:</b> ${p.vehiclePlate}`,
    `🏢 <b>Origen:</b> ${p.origin}`,
    `🎯 <b>Destino:</b> ${p.destination}`,
    `🕐 <b>Inicio:</b> ${fmtDate(p.startedAt)}`,
    p.comment ? `💬 <b>Nota:</b> ${p.comment}` : '',
    '',
    `🔗 ID: ${tripId(p.tripId)}`,
  ].filter(Boolean).join('\n');
}

export function buildTripStopMessage(p: {
  tripId: string; driverName: string; vehiclePlate: string;
  destination: string; comment?: string | null; timestamp: Date;
}): string {
  return [
    '🅿️ <b>Parada Registrada</b>',
    '',
    `👤 <b>Motorista:</b> ${p.driverName}`,
    `🚙 <b>Vehículo:</b> ${p.vehiclePlate}`,
    `🎯 <b>En ruta a:</b> ${p.destination}`,
    `🕐 <b>Hora:</b> ${fmtTime(p.timestamp)}`,
    p.comment ? `💬 <b>Motivo:</b> ${p.comment}` : '',
    '',
    `🔗 ID: ${tripId(p.tripId)}`,
  ].filter(Boolean).join('\n');
}

export function buildTripResumeMessage(p: {
  tripId: string; driverName: string; vehiclePlate: string;
  destination: string; timestamp: Date;
}): string {
  return [
    '▶️ <b>Ruta Continuada</b>',
    '',
    `👤 <b>Motorista:</b> ${p.driverName}`,
    `🚙 <b>Vehículo:</b> ${p.vehiclePlate}`,
    `🎯 <b>Destino:</b> ${p.destination}`,
    `🕐 <b>Hora:</b> ${fmtTime(p.timestamp)}`,
    '',
    `🔗 ID: ${tripId(p.tripId)}`,
  ].filter(Boolean).join('\n');
}

export function buildIncidentMessage(p: {
  tripId: string; driverName: string; vehiclePlate: string;
  destination: string; incidentComment: string; timestamp: Date;
}): string {
  return [
    '🚨 <b>INCIDENCIA REPORTADA</b>',
    '',
    `👤 <b>Motorista:</b> ${p.driverName}`,
    `🚙 <b>Vehículo:</b> ${p.vehiclePlate}`,
    `🎯 <b>En ruta a:</b> ${p.destination}`,
    `🕐 <b>Hora:</b> ${fmtTime(p.timestamp)}`,
    `⚠️ <b>Descripción:</b> ${p.incidentComment}`,
    '',
    `🔗 ID: ${tripId(p.tripId)}`,
  ].filter(Boolean).join('\n');
}

export function buildTripFinishedMessage(p: NotificationPayload): string {
  const duration = p.durationMinutes;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  const durationStr = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

  return [
    '✅ <b>Viaje Finalizado — Resumen</b>',
    '━━━━━━━━━━━━━━━━━━━━━━',
    `👤 <b>Motorista:</b> ${p.driverName}`,
    `🚙 <b>Vehículo:</b> ${p.vehiclePlate}`,
    `🏢 <b>Origen:</b> ${p.origin}`,
    `🎯 <b>Destino:</b> ${p.destination}`,
    '━━━━━━━━━━━━━━━━━━━━━━',
    `🕐 <b>Inicio:</b> ${fmtDate(new Date(p.startedAt))}`,
    `🕑 <b>Fin:</b> ${fmtTime(new Date(p.finishedAt))}`,
    `⏱️ <b>Duración total:</b> ${durationStr}`,
    p.comment ? `💬 <b>Comentario:</b> ${p.comment}` : '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    `🔗 ID: ${tripId(p.tripId)}`,
  ].filter(Boolean).join('\n');
}

// ─────────────────────────────────────────────────────────
// Notification Service
// ─────────────────────────────────────────────────────────

export class NotificationService {
  private adapter: TelegramAdapter;

  constructor() {
    this.adapter = new TelegramAdapter();
  }

  private async send(message: string): Promise<NotificationResult> {
    const result = await this.adapter.sendRaw(message);
    if (!result.success) {
      console.warn(`[NOTIFICATION] telegram failed: ${result.error}`);
    } else {
      console.log(`[NOTIFICATION] telegram sent successfully`);
    }
    return result;
  }

  async sendTripStarted(p: Parameters<typeof buildTripStartedMessage>[0]): Promise<NotificationResult> {
    return this.send(buildTripStartedMessage(p));
  }

  async sendTripStop(p: Parameters<typeof buildTripStopMessage>[0]): Promise<NotificationResult> {
    return this.send(buildTripStopMessage(p));
  }

  async sendTripResume(p: Parameters<typeof buildTripResumeMessage>[0]): Promise<NotificationResult> {
    return this.send(buildTripResumeMessage(p));
  }

  async sendIncident(p: Parameters<typeof buildIncidentMessage>[0]): Promise<NotificationResult> {
    return this.send(buildIncidentMessage(p));
  }

  async sendTripFinished(payload: NotificationPayload): Promise<NotificationResult[]> {
    const result = await this.send(buildTripFinishedMessage(payload));
    return [result];
  }
}

export const notificationService = new NotificationService();
