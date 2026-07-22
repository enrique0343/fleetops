// Password hashing + verification using the Web Crypto API (PBKDF2-HMAC-SHA256).
// Works natively on Cloudflare Workers (bcrypt would exceed the Worker CPU limit).
// Stored format:  pbkdf2$<iterations>$<saltBase64>$<hashBase64>

const ITERATIONS = 100_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const encoder = new TextEncoder();

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_BYTES * 8
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${bufToB64(salt.buffer)}$${bufToB64(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = b64ToBuf(parts[2]);
  const bits = await derive(password, salt, iterations);
  const computed = bufToB64(bits);
  // Constant-time-ish comparison
  if (computed.length !== parts[3].length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ parts[3].charCodeAt(i);
  return diff === 0;
}
