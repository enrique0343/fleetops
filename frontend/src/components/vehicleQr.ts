// Codificación/parseo del payload del QR de vehículo (sin dependencias pesadas,
// para no arrastrar html5-qrcode/qrcode al bundle principal).
// Formato: fleetops:vehicle:<id>:<plate>

export function vehicleQrPayload(id: string, plate: string): string {
  return `fleetops:vehicle:${id}:${plate}`;
}

export function parseVehicleQr(text: string): { id: string; plate: string } | null {
  const m = /^fleetops:vehicle:([^:]+):(.+)$/.exec(text.trim());
  if (m) return { id: m[1], plate: m[2] };
  return null;
}
