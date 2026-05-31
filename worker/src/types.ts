import type { PrismaClient } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string; // DRIVER | ADMIN
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

export interface Bindings {
  DB: D1Database;
  JWT_SECRET: string;
  JWT_EXPIRES_IN?: string;
  CORS_ORIGIN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  SEED_TOKEN?: string;
}

export interface Variables {
  prisma: PrismaClient;
  user: JwtPayload;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
