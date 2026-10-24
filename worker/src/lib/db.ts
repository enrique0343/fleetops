import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import type { Bindings } from '../types';

// A fresh PrismaClient is created per request because the D1 binding
// only exists within the request scope of a Cloudflare Worker.
export function getPrisma(env: Bindings): PrismaClient {
  const adapter = new PrismaD1(env.DB);
  return new PrismaClient({ adapter });
}
