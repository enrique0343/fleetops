import type { PrismaClient } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string; // DRIVER | ADMIN | REQUESTER | DISPATCHER
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
  OSRM_URL?: string; // optional free OSM routing engine for multi-stop optimization
  PUBLIC_FORM_TOKEN?: string; // token del enlace público de solicitudes
  GOOGLE_MAPS_API_KEY?: string; // geocodificación Google Places (mejor cobertura ES)
  MAPBOX_TOKEN?: string; // geocodificación Mapbox (alternativa)
}

export interface Variables {
  prisma: PrismaClient;
  user: JwtPayload;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
