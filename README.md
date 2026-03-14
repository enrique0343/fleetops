# 🚛 FleetOps — Control de Transporte Corporativo

Sistema web MVP para gestión de transporte corporativo con roles de **motorista** y **administrador**.

## ✨ Funcionalidades del MVP

### Motorista (mobile-first)
- Iniciar viaje (sucursal, vehículo, destino)
- Registrar paradas e incidencias
- Continuar ruta / Finalizar viaje
- Registro de cargas de combustible
- Historial personal de viajes

### Administrador (backoffice)
- Dashboard con KPIs operativos
- Tabla de viajes con filtros avanzados
- Timeline de eventos por viaje
- Forzar cierre de viajes con auditoría
- Correcciones administrativas trazables
- Gestión de usuarios, vehículos, sucursales, ubicaciones
- Módulo de combustible con KPIs
- Log de auditoría completo
- Reintento manual de notificación Telegram

---

## 🗂 Estructura del proyecto

```
fleetops/
├── backend/          # Node.js + Express + TypeScript + Prisma
├── frontend/         # React + Vite + TypeScript + TailwindCSS
└── README.md
```

---

## ⚙️ Requisitos previos

- **Node.js** v18 o superior
- **PostgreSQL** v14 o superior
- **npm** v9 o superior

---

## 🚀 Instalación paso a paso

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/fleetops.git
cd fleetops
```

---

### 2. Configurar el Backend

```bash
cd backend
npm install
```

Copia el archivo de variables de entorno:

```bash
cp .env.example .env
```

Edita `.env` con tus datos:

```env
DATABASE_URL="postgresql://TU_USUARIO:TU_PASSWORD@localhost:5432/fleetops_db"
JWT_SECRET="cambia-esto-por-una-clave-segura-de-al-menos-32-caracteres"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"

# Opcional — Telegram (sin esto la app funciona, solo registra el fallo)
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
```

Crea la base de datos en PostgreSQL:

```sql
CREATE DATABASE fleetops_db;
```

Ejecuta las migraciones y genera el cliente Prisma:

```bash
npm run db:generate
npm run db:push
```

Carga los datos iniciales (seed):

```bash
npm run db:seed
```

Inicia el servidor en modo desarrollo:

```bash
npm run dev
```

El backend estará disponible en: `http://localhost:3001`

Verifica con: `http://localhost:3001/health`

---

### 3. Configurar el Frontend

En otra terminal:

```bash
cd frontend
npm install
```

Copia el archivo de variables de entorno:

```bash
cp .env.example .env
```

El archivo `.env` del frontend:

```env
VITE_API_URL=http://localhost:3001/api
```

Inicia el servidor de desarrollo:

```bash
npm run dev
```

El frontend estará disponible en: `http://localhost:5173`

---

## 🔐 Credenciales iniciales (seed)

| Rol | Email | Contraseña |
|-----|-------|------------|
| Administrador | admin@fleetops.com | Admin1234! |
| Motorista 1 | carlos.mendez@fleetops.com | Driver1234! |
| Motorista 2 | ana.garcia@fleetops.com | Driver1234! |

---

## 📱 Acceso por rol

- **Motoristas** → `http://localhost:5173/driver` (mobile-first)
- **Administradores** → `http://localhost:5173/admin`
- Login automático según rol al autenticarse

---

## 🧱 Stack técnico

### Backend
- Node.js + Express + TypeScript
- Prisma ORM + PostgreSQL
- JWT para autenticación
- Adapter pattern para notificaciones (Telegram / extensible)
- express-validator para validaciones

### Frontend
- React 18 + Vite + TypeScript
- TailwindCSS (mobile-first)
- React Router v6
- Axios para HTTP
- date-fns para fechas

---

## 📡 API Endpoints principales

```
POST   /api/auth/login              Iniciar sesión
POST   /api/auth/register           Registrar usuario
GET    /api/auth/me                 Usuario actual

GET    /api/trips                   Listar viajes (admin)
POST   /api/trips/start             Iniciar viaje
GET    /api/trips/my/active         Viaje activo del motorista
POST   /api/trips/:id/stop          Registrar parada
POST   /api/trips/:id/resume        Continuar ruta
POST   /api/trips/:id/incident      Reportar incidencia
POST   /api/trips/:id/finish        Finalizar viaje
POST   /api/trips/:id/force-close   Forzar cierre (admin)
PATCH  /api/trips/:id/correction    Corrección administrativa (admin)
GET    /api/trips/admin/dashboard   KPIs del dashboard

GET    /api/fuel                    Listar cargas de combustible
POST   /api/fuel                    Registrar carga
PATCH  /api/fuel/:id                Corregir carga (admin)
GET    /api/fuel/admin/kpis         KPIs de combustible

GET    /api/catalogs/branches       Sucursales
GET    /api/catalogs/vehicles       Vehículos
GET    /api/catalogs/locations      Ubicaciones / destinos
GET    /api/catalogs/users          Usuarios (admin)
GET    /api/catalogs/incident-types Tipos de incidencia

GET    /api/audit                   Log de auditoría (admin)
```

---

## 🔔 Configurar Telegram (opcional)

1. Crea un bot en Telegram con [@BotFather](https://t.me/botfather) → obtén el `TELEGRAM_BOT_TOKEN`
2. Obtén tu `TELEGRAM_CHAT_ID` enviando un mensaje al bot y consultando:
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
3. Agrega ambos valores al `.env` del backend
4. Sin configurar, el sistema registra el fallo correctamente en la base de datos — no rompe nada

---

## 🗄️ Modelo de datos (resumen)

```
User         → Motoristas y administradores
Branch       → Sucursales de la organización
Location     → Destinos y ubicaciones operativas
Vehicle      → Flota de vehículos
Trip         → Viaje con máquina de estados
TripEvent    → Log inmutable de eventos de cada viaje
IncidentType → Catálogo de tipos de incidencia
FuelRecord   → Registros de carga de combustible
AuditLog     → Auditoría de mutaciones administrativas
PasswordReset → Tokens de recuperación de contraseña
```

---

## 🚦 Estados del viaje

```
IN_TRANSIT → IN_STOP → IN_TRANSIT
IN_TRANSIT → IN_INCIDENT → IN_TRANSIT
IN_TRANSIT / IN_STOP / IN_INCIDENT → FINISHED
Cualquier estado activo → FINISHED (admin, forced_close)
```

---

## 📦 Scripts disponibles

### Backend
```bash
npm run dev          # Desarrollo con hot reload
npm run build        # Compilar TypeScript
npm run start        # Producción
npm run db:generate  # Generar cliente Prisma
npm run db:push      # Aplicar schema a la DB
npm run db:migrate   # Crear migración formal
npm run db:seed      # Cargar datos iniciales
npm run db:studio    # Abrir Prisma Studio (GUI de DB)
```

### Frontend
```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run preview      # Preview del build
```

---

## 🗺️ Fases de desarrollo

| Fase | Estado | Contenido |
|------|--------|-----------|
| **Fase 1** | ✅ MVP | Auth, catálogos, flujo de viaje, incidentes, combustible básico, Telegram |
| **Fase 2** | 🔜 | Filtros avanzados, KPIs completos, offline básico |
| **Fase 3** | 📋 | PWA robusta, WhatsApp, reportes exportables |

---

## 🤝 Contribuir

1. Fork del repositorio
2. Crea una rama: `git checkout -b feature/nombre-feature`
3. Commit: `git commit -m 'feat: descripción'`
4. Push: `git push origin feature/nombre-feature`
5. Abre un Pull Request

---

## 📄 Licencia

MIT — Uso libre con atribución.
