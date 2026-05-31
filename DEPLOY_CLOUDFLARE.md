# Despliegue 100% en Cloudflare

FleetOps desplegado completamente en Cloudflare:

| Componente | Servicio Cloudflare |
|-----------|---------------------|
| Frontend (React + Vite) | **Cloudflare Pages** |
| Backend API (Hono) | **Cloudflare Workers** (`worker/`) |
| Base de datos | **Cloudflare D1** (SQLite) |
| Notificaciones | Telegram vía `fetch` (dentro del Worker) |

El backend Express original (`backend/`) se mantiene como referencia/legacy.
El backend que se despliega en Cloudflare es `worker/`.

---

## Requisitos previos

```bash
npm install -g wrangler
wrangler login          # autentica tu cuenta de Cloudflare
```

---

## 1. Backend (Worker + D1)

```bash
cd worker
npm install

# 1.1 Crear la base de datos D1
wrangler d1 create fleetops
# Copia el "database_id" que imprime y pégalo en worker/wrangler.toml
#   [[d1_databases]] database_id = "..."

# 1.2 Generar el cliente Prisma
npm run db:generate

# 1.3 Generar la migración SQL del esquema (crea migrations/0001_init.sql)
npm run db:diff

# 1.4 Aplicar migraciones a D1 (remoto)
npm run db:migrate:remote

# 1.5 Configurar secretos
wrangler secret put JWT_SECRET        # cadena aleatoria de >= 32 caracteres
wrangler secret put SEED_TOKEN        # token de un solo uso para sembrar datos
wrangler secret put TELEGRAM_BOT_TOKEN   # (opcional)
wrangler secret put TELEGRAM_CHAT_ID     # (opcional)

# 1.6 Ajusta CORS_ORIGIN en wrangler.toml con la URL final de Pages
#     (puedes volver a este paso tras crear Pages y luego `wrangler deploy` de nuevo)

# 1.7 Desplegar el Worker
npm run deploy
# Anota la URL: https://fleetops-api.<subdominio>.workers.dev
```

### Sembrar datos iniciales (una sola vez)

```bash
curl -X POST https://fleetops-api.<subdominio>.workers.dev/api/seed \
  -H "x-seed-token: <EL_SEED_TOKEN_QUE_PUSISTE>"
```

Credenciales sembradas:
- Admin: `admin@fleetops.com` / `admin123`
- Conductor: `driver@fleetops.com` / `driver123`

> Cambia estas contraseñas tras el primer acceso.

---

## 2. Frontend (Pages)

```bash
cd frontend

# Apunta el frontend al Worker
echo 'VITE_API_URL="https://fleetops-api.<subdominio>.workers.dev"' > .env.production

npm install
npm run build         # genera dist/

# Desplegar a Cloudflare Pages
wrangler pages deploy dist --project-name fleetops-frontend
# Anota la URL: https://fleetops-frontend.pages.dev
```

El archivo `frontend/public/_redirects` ya incluye el rewrite SPA
(`/* /index.html 200`).

---

## 3. Cerrar el círculo (CORS)

1. Edita `worker/wrangler.toml` → `CORS_ORIGIN = "https://fleetops-frontend.pages.dev"`.
2. `cd worker && wrangler deploy` para aplicar.

---

## Desarrollo local

```bash
# Backend
cd worker
cp .dev.vars.example .dev.vars   # rellena JWT_SECRET, SEED_TOKEN
npm run db:diff
wrangler d1 migrations apply fleetops --local
npm run dev                       # http://localhost:8787

# Frontend (en otra terminal)
cd frontend
npm run dev                       # http://localhost:5173 (proxy /api -> :8787 si ajustas vite.config)
```

---

## Notas técnicas de la migración

- **Express → Hono**: misma lógica de negocio y mismos endpoints/respuestas.
- **PostgreSQL → D1 (SQLite)**:
  - Los `enum` de Prisma se convirtieron a `String` (SQLite no soporta enums).
  - Los campos `Json` (`metadata`, `old_value`, `new_value`) se guardan como
    texto JSON y se codifican/decodifican en `src/lib/json.ts`.
- **bcrypt → PBKDF2 (Web Crypto)**: bcrypt excede el límite de CPU del Worker;
  se usa PBKDF2-HMAC-SHA256 nativo. Formato: `pbkdf2$iter$saltB64$hashB64`.
- **jsonwebtoken → hono/jwt**: firma/verificación HS256 con Web Crypto.
- **Notificaciones**: no bloqueantes vía `c.executionCtx.waitUntil(...)`.

## Seguridad — acción requerida

El `backend/.env.example` contenía secretos reales (token de Telegram y
contraseña de Supabase). **Rótalos**: regenera el bot de Telegram y cambia la
contraseña de la base de datos de Supabase.
