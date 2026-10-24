import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { authenticate } from '../middleware/auth';
import { activeProvider } from '../lib/geocode';

// Configuración que el frontend necesita en runtime (sin hornearla en el build).
const config = new Hono<AppEnv>();

config.get('/', authenticate, (c) => {
  return c.json({
    success: true,
    data: {
      // Clave de navegador para Google Maps JS (restringida por dominio).
      googleMapsKey: c.env.GOOGLE_MAPS_BROWSER_KEY || null,
      geocoder: activeProvider(c.env),
    },
  });
});

export default config;
