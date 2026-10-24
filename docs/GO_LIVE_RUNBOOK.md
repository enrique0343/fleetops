# FleetOps — Runbook de puesta en producción (Cloudflare)

Guía paso a paso para desplegar **todo en Cloudflare**: API (Workers) + base de
datos (D1) + frontend (Pages). Tiempo estimado: 30–45 min la primera vez.

> Resumen del complemento técnico de deploy está en `DEPLOY_CLOUDFLARE.md`.
> Este runbook es la versión operativa con checklist y verificación.

---

## ⚠️ Paso 0 — Seguridad (hacer ANTES de cualquier cosa)

El archivo `backend/.env.example` contiene **secretos reales** en el historial
de git (token del bot de Telegram y contraseña de la base de datos de Supabase
del backend legacy). **Hay que rotarlos**:

- [ ] **Telegram**: abre @BotFather → `/revoke` el token actual y genera uno
      nuevo. Usa el nuevo solo como *secret* de Cloudflare (ver Paso 3), nunca
      en archivos versionados.
- [ ] **Supabase / Postgres**: cambia la contraseña de la base del proyecto
      legacy (Dashboard de Supabase → Database → Reset password). El nuevo
      stack usa D1, así que esta DB solo importa si sigues usando `backend/`.
- [ ] Confirma que ningún `.env` real esté commiteado: solo deben existir
      archivos `*.example` con placeholders.

> El nuevo backend (`worker/`) NO usa estos secretos; toma todo de los *secrets*
> de Cloudflare. El riesgo es la exposición histórica, por eso se rotan.

---

## Paso 1 — Prerrequisitos

- [ ] Cuenta de Cloudflare (gratuita sirve para empezar).
- [ ] Node 18+ y `npm`.
- [ ] Instalar y autenticar Wrangler:

```bash
npm install -g wrangler
wrangler login          # abre el navegador para autorizar
wrangler whoami         # confirma la cuenta
```

---

## Paso 2 — Base de datos D1

```bash
cd worker
npm install

# Crear la base D1
wrangler d1 create fleetops
```

- [ ] Copia el `database_id` que imprime y pégalo en `worker/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "fleetops"
database_id = "PEGA_AQUI_EL_ID"
migrations_dir = "migrations"
```

Las migraciones ya están versionadas (`0001_init.sql`,
`0002_appointments_routing.sql`). Genera el cliente y aplícalas en remoto:

```bash
npm run db:generate
npm run db:migrate:remote      # aplica 0001 y 0002 a la D1 de producción
```

- [ ] Verifica: `wrangler d1 execute fleetops --remote --command "SELECT name FROM sqlite_master WHERE type='table';"`
      (deberías ver `transport_requests`, `route_plans`, `service_windows`, etc.)

---

## Paso 3 — Secretos del Worker

```bash
wrangler secret put JWT_SECRET          # cadena aleatoria >= 32 chars
wrangler secret put SEED_TOKEN          # token de un solo uso para sembrar
wrangler secret put TELEGRAM_BOT_TOKEN  # (opcional) el NUEVO token rotado
wrangler secret put TELEGRAM_CHAT_ID    # (opcional)
# (opcional) motor de rutas OSM real; sin esto se usa heurística integrada:
wrangler secret put OSRM_URL            # ej. https://router.project-osrm.org
```

Genera un `JWT_SECRET` robusto:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## Paso 4 — Desplegar el Worker (API)

```bash
npm run deploy
```

- [ ] Anota la URL: `https://fleetops-api.<tu-subdominio>.workers.dev`
- [ ] Verifica salud: `curl https://fleetops-api.<sub>.workers.dev/health`

### Sembrar datos iniciales (una sola vez)

```bash
curl -X POST https://fleetops-api.<sub>.workers.dev/api/seed \
  -H "x-seed-token: <EL_SEED_TOKEN>"
```

Crea usuarios de prueba (cámbiales la contraseña tras entrar):
- Admin: `admin@fleetops.com` / `admin123`
- Conductor: `driver@fleetops.com` / `driver123`
- Solicitante: `medico@fleetops.com` / `medico123`
- Dispatcher: `dispatcher@fleetops.com` / `dispatch123`
- Incluye 1 ambulancia (`AMB-001`), horarios de servicio y 1 proveedor externo.

---

## Paso 5 — Frontend (Pages)

```bash
cd ../frontend
echo 'VITE_API_URL="https://fleetops-api.<sub>.workers.dev"' > .env.production
npm install
npm run build
wrangler pages deploy dist --project-name fleetops-frontend
```

- [ ] Anota la URL: `https://fleetops-frontend.pages.dev`
      (el `frontend/public/_redirects` ya maneja el ruteo SPA)

---

## Paso 6 — Cerrar CORS

1. [ ] En `worker/wrangler.toml`, fija `CORS_ORIGIN` con la URL de Pages:
   ```toml
   [vars]
   CORS_ORIGIN = "https://fleetops-frontend.pages.dev"
   ```
2. [ ] Redespliega el Worker: `cd ../worker && npm run deploy`

---

## Paso 7 — Verificación funcional (smoke test en producción)

- [ ] Login como **dispatcher** → ver Dashboard con KPIs.
- [ ] Login como **médico** → crear una solicitud de ambulancia; el widget de
      disponibilidad muestra semáforo y slots.
- [ ] Como **dispatcher** → aprobar, asignar (vehículo + conductor) y despachar.
- [ ] Como **conductor** → pestaña "Citas": ver la cita y **iniciar el viaje**.
- [ ] Finalizar el viaje → la solicitud pasa a `COMPLETED` y (si Telegram está
      configurado) llega la notificación.
- [ ] **Agenda** del dispatcher muestra la cita en el día correcto.
- [ ] **Rutas**: crear 2–3 tareas, optimizar, ver orden + enlaces de navegación.

---

## Operación continua

- **Migraciones nuevas**: tras cambiar `schema.prisma`, genera el delta con
  `prisma migrate diff` contra la D1 remota y guarda el `.sql` incremental en
  `worker/migrations/`, luego `npm run db:migrate:remote`.
- **Logs en vivo**: `wrangler tail` (Worker) desde `worker/`.
- **Rollback de Pages**: el dashboard de Cloudflare Pages permite volver a un
  deployment anterior con un clic.
- **MCP de ruteo** (opcional, conversacional): ver `mcp-routing/README.md`.

---

## Costos

Todo el stack base cabe en planes **gratuitos** de Cloudflare (Workers, D1,
Pages) para volúmenes pequeños/medianos. El mapa/ruteo usa OSM/Leaflet/Waze/
Maps (gratis). El único costo potencial es self-hostear OSRM/VROOM si no usas la
API gratuita de OpenRouteService.
