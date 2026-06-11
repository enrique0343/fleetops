# Módulo de Citas / Solicitudes de Transporte — Diseño de Arquitectura

> Estado: **propuesta de diseño** (sin implementar). Documento para revisión.
> Decisiones de producto tomadas:
> 1. Las solicitudes se crean mediante un **formulario de solicitud**, pero un
>    usuario interno **puede iniciar un viaje sin cita** (se preserva el flujo
>    ad-hoc actual).
> 2. El módulo de citas lo **administra un administrador/coordinador** dentro
>    del aplicativo.
> 3. Las ambulancias en **emergencia pueden saltarse la agenda** (despacho
>    inmediato) y se mide su **SLA de respuesta**.
>
> **Ampliación v2** (ver `APPOINTMENTS_MODULE_DESIGN_V2.md`): disponibilidad de
> ambulancias **visible para el profesional** con **fallback a outsourcing**;
> **horarios de servicio configurables**; **pool de tareas + ruteo
> multi-parada** con GPS gratuito (OSM) e **híbrido Claude/MCP + solver**;
> **auto-despacho de emergencia no-ambulancia**.

---

## 1. Idea central

Hoy FleetOps **registra** viajes que el conductor inicia de forma espontánea.
Este módulo añade una **capa de planificación** por encima: solicitar
transporte como una **cita** sujeta a **disponibilidad de agenda**.

La clave del diseño: **no duplicamos la lógica de viajes**. Una solicitud
aprobada, al despacharse, **genera un `Trip`** — el mismo `Trip` que ya tiene
máquina de estados, geolocalización, notificación Telegram y auditoría.

```
TransportRequest (cita)                         Trip (ejecución, ya existe)
─────────────────────────                       ───────────────────────────
PENDING ──► APPROVED ──► SCHEDULED ──despacho──► IN_TRANSIT ─► ... ─► FINISHED
   │            │            │                        │
 (rechazo)  (asignación   (conductor                  └─ al finalizar, la
            veh.+chofer)   inicia)                       solicitud pasa a COMPLETED

Viaje ad-hoc (sin cita):   ────────────────────► IN_TRANSIT  (requestId = null)
```

- Un `Trip` puede existir **con** o **sin** solicitud previa (campo opcional
  `requestId`). Los viajes espontáneos de hoy siguen funcionando igual.
- Una `TransportRequest` referencia el `Trip` que la ejecutó (`tripId`).

---

## 2. Transporte estándar vs. Ambulancia

Misma lógica, **discriminada por un campo `serviceType`**, no por un sistema
paralelo. La diferencia se modela con datos opcionales y reglas de validación.

| Aspecto | `STANDARD` | `AMBULANCE` |
|---|---|---|
| Solicitante | Personal interno / sucursal | Profesional médico (queda registrado) |
| Datos extra | Nº pasajeros, motivo | Paciente, condición, camilla, oxígeno |
| Prioridad | `SCHEDULED` | `SCHEDULED`, `URGENT` o `EMERGENCY` |
| Agenda | Siempre programada | Programada **o** despacho inmediato (emergencia) |
| Vehículo elegible | Cualquiera activo | Solo unidades con `isAmbulance = true` (y `hasStretcher`/`hasOxygen` si se requieren) |
| Trazabilidad | Estándar | Estándar + **SLA de respuesta** + auditoría reforzada |

Agregar ambulancias es **incremental**: los mismos endpoints y estados, con
un bloque de campos clínicos y reglas de elegibilidad de vehículo.

---

## 3. Modelo de datos

### 3.1 Entidades nuevas

#### `TransportRequest` — la cita
```
id                String   @id @default(uuid())
code              String   @unique            // folio legible, ej. REQ-2026-000123
serviceType       String                      // STANDARD | AMBULANCE
priority          String   @default("SCHEDULED") // SCHEDULED | URGENT | EMERGENCY
status            String   @default("PENDING")   // ver máquina de estados §4

// Solicitante
requesterId       String?                     // FK User (si es interno con login)
requesterName     String                      // nombre libre (cubre formulario sin login)
requesterPhone    String?
requesterDept     String?                     // departamento / área / profesional

// Ruta y agenda
originId          String                      // FK Location
destinationId     String                      // FK Location
scheduledAt       DateTime                    // inicio solicitado
windowMinutes     Int      @default(30)       // tolerancia de la ventana
estimatedMinutes  Int?                        // duración estimada (para detectar solapes)

// Carga / pasajeros (STANDARD)
passengerCount    Int?
reason            String?

// Bloque clínico (AMBULANCE) — todos opcionales
patientName       String?
patientCondition  String?                     // texto u opción de catálogo
requiresStretcher Boolean  @default(false)
requiresOxygen    Boolean  @default(false)
clinicalNotes     String?

// Asignación (la hace admin/dispatcher)
assignedVehicleId String?                     // FK Vehicle
assignedDriverId  String?                     // FK User (DRIVER)
approvedById      String?                     // FK User (ADMIN/DISPATCHER)
approvedAt        DateTime?
rejectionReason   String?

// Ejecución
tripId            String?  @unique            // FK Trip generado al despachar
dispatchedAt      DateTime?
completedAt       DateTime?

// SLA (sobre todo ambulancia/emergencia)
slaTargetAt       DateTime?                   // fecha límite de respuesta
slaMetFlag        Boolean?                    // se calcula al despachar

createdAt         DateTime @default(now())
updatedAt         DateTime @updatedAt
```

#### `RequestEvent` — bitácora inmutable de la solicitud
Análogo a `TripEvent`. Registra cada transición y acción.
```
id          String   @id @default(uuid())
requestId   String
type        String   // CREATED | APPROVED | REJECTED | ASSIGNED | RESCHEDULED |
                     // DISPATCHED | COMPLETED | CANCELLED | NO_SHOW | EMERGENCY_OVERRIDE
userId      String?  // quién la ejecutó (null si formulario público)
comment     String?
metadata    String?  // JSON-encoded (igual patrón que TripEvent en D1)
createdAt   DateTime @default(now())
```

#### `ScheduleBlock` — bloqueos de agenda (disponibilidad real)
Permite marcar un recurso (vehículo o conductor) como no disponible:
mantenimiento, turno/descanso, reserva.
```
id          String   @id @default(uuid())
resourceType String                          // VEHICLE | DRIVER
vehicleId   String?
driverId    String?
reason      String                           // MAINTENANCE | SHIFT | OFF | RESERVED | OTHER
startAt     DateTime
endAt       DateTime
note        String?
createdById String
createdAt   DateTime @default(now())
```

### 3.2 Extensiones a entidades existentes

**`Vehicle`** — capacidades para ambulancia:
```
isAmbulance   Boolean @default(false)
hasStretcher  Boolean @default(false)
hasOxygen     Boolean @default(false)
```

**`Trip`** — enlace opcional a la solicitud que lo originó:
```
requestId     String?  @unique   // null = viaje ad-hoc (flujo actual)
```

**`User` / `UserRole`** — nuevos roles (como `String`, ya que en D1 los enums
son texto):
- **`REQUESTER`** — solicitante interno; crea y ve sus propias solicitudes.
- **`DISPATCHER`** — coordinador de agenda (opcional). Si no se usa, **ADMIN**
  asume estas funciones.

> Compatibilidad: los roles existentes (`DRIVER`, `ADMIN`) no cambian. El
> middleware de autorización solo añade `requireRole('ADMIN','DISPATCHER')`
> para gestión de citas.

---

## 4. Máquina de estados de la solicitud

```
                 ┌─────────► REJECTED  (con rejectionReason)
                 │
PENDING ──────► APPROVED ──────► SCHEDULED ──────► DISPATCHED ──────► COMPLETED
   │                                  │                 │
   │                                  ├─► RESCHEDULED ──┘  (vuelve a SCHEDULED)
   │                                  │
   └──► CANCELLED                     └──► NO_SHOW / CANCELLED

EMERGENCY (ambulancia):
PENDING ──EMERGENCY_OVERRIDE──► DISPATCHED   (salta APPROVED/SCHEDULED;
                                              registra slaMetFlag y evento)
```

Transiciones válidas (a validar en el servicio, igual que `VALID_TRANSITIONS`
en `tripService`):

| Desde | Hacia |
|---|---|
| `PENDING` | `APPROVED`, `REJECTED`, `CANCELLED`, `DISPATCHED`* |
| `APPROVED` | `SCHEDULED`, `CANCELLED` |
| `SCHEDULED` | `DISPATCHED`, `RESCHEDULED`, `CANCELLED`, `NO_SHOW` |
| `RESCHEDULED` | `SCHEDULED` |
| `DISPATCHED` | `COMPLETED`, `CANCELLED` |

\* `PENDING → DISPATCHED` solo vía `EMERGENCY_OVERRIDE` (ambulancia/emergencia).

---

## 5. Lógica de disponibilidad ("la agenda")

Pragmática, sin sobre-ingeniería. Un par **(vehículo, conductor)** está
disponible para una ventana `[scheduledAt, scheduledAt + estimatedMinutes]` si:

1. **Sin solapamiento de citas**: ninguna otra `TransportRequest` con estado
   `SCHEDULED`/`DISPATCHED` para ese vehículo o conductor cuya ventana se cruce.
2. **Sin viaje activo** en ese rango (vehículo sin `currentTripId`, conductor
   sin viaje en `IN_TRANSIT/IN_STOP/IN_INCIDENT` que se solape).
3. **Sin `ScheduleBlock`** que se cruce (mantenimiento, turno, etc.).
4. **Compatibilidad de servicio** (si `AMBULANCE`): `vehicle.isAmbulance` y, si
   la solicitud lo pide, `hasStretcher` / `hasOxygen`.

> Helper sugerido: `getAvailableResources(serviceType, scheduledAt, estMinutes,
> caps)` → devuelve vehículos y conductores libres, para alimentar el selector
> de asignación y sugerir "slots".

**Emergencia**: la validación 1-3 se relaja (el override es deliberado y queda
auditado); solo se respeta la compatibilidad de vehículo (4) salvo que no haya
ninguna ambulancia, en cuyo caso se alerta.

---

## 6. API (endpoints nuevos, estilo Hono actual)

Prefijo `/api/requests`. Respuestas con la envoltura `{ success, data|error }`
existente.

### Solicitante / formulario
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| `POST` | `/api/requests` | REQUESTER / público* | Crear solicitud (`PENDING`) |
| `GET`  | `/api/requests/my` | REQUESTER | Mis solicitudes |
| `GET`  | `/api/requests/:id` | dueño / ADMIN | Detalle + timeline |
| `POST` | `/api/requests/:id/cancel` | dueño / ADMIN | Cancelar |

\* Si se habilita formulario público: `POST` sin auth protegido con token de
formulario + Cloudflare Turnstile (anti-bot); cae como `PENDING`.

### Administración / dispatcher
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| `GET`  | `/api/requests` | ADMIN/DISPATCHER | Bandeja con filtros (status, serviceType, priority, fecha, sucursal) |
| `GET`  | `/api/requests/availability` | ADMIN/DISPATCHER | Recursos libres para una ventana |
| `POST` | `/api/requests/:id/approve` | ADMIN/DISPATCHER | Aprobar |
| `POST` | `/api/requests/:id/reject` | ADMIN/DISPATCHER | Rechazar (con motivo) |
| `POST` | `/api/requests/:id/assign` | ADMIN/DISPATCHER | Asignar vehículo+conductor → `SCHEDULED` (valida disponibilidad) |
| `POST` | `/api/requests/:id/reschedule` | ADMIN/DISPATCHER | Reprogramar |
| `POST` | `/api/requests/:id/dispatch` | ADMIN/DISPATCHER | Genera el `Trip` y enlaza (`tripId`) |
| `POST` | `/api/requests/:id/emergency-dispatch` | ADMIN/DISPATCHER | Despacho inmediato de ambulancia (override) |
| `GET`  | `/api/requests/calendar` | ADMIN/DISPATCHER | Vista agenda (rango de fechas) |
| `GET`  | `/api/requests/admin/stats` | ADMIN | KPIs (pendientes, SLA ambulancia, no-shows) |

### Agenda / bloqueos
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| `GET/POST/DELETE` | `/api/schedule-blocks` | ADMIN/DISPATCHER | Gestionar bloqueos de vehículos/conductores |

### Punto de unión con lo existente
- `dispatch` crea el `Trip` reutilizando `TripService` (con `requestId`,
  `assignedDriverId`, `assignedVehicleId`). **No se reescribe nada del
  lifecycle de viajes.**
- Al `finishTrip`, un hook actualiza la solicitud a `COMPLETED`
  (`completedAt`) y emite `RequestEvent` `COMPLETED`.
- La integración Telegram ya existente notifica también la **asignación** y el
  **despacho de emergencia** (nuevos templates).

---

## 7. Frontend (vistas nuevas)

### Solicitante (o formulario)
- **Formulario de solicitud** (`/request/new`): tipo de servicio,
  origen/destino, fecha-hora deseada, pasajeros **o** bloque de paciente si es
  ambulancia. Muestra ventanas disponibles sugeridas.
- **Mis solicitudes**: lista con estado y seguimiento.

### Conductor (extiende la app móvil actual)
- **"Mis citas de hoy"**: nueva pestaña; el conductor ve las citas asignadas y
  puede **iniciar el viaje** desde ahí (rellena el setup automáticamente).
- Se conserva el botón **"Iniciar viaje sin cita"** (flujo ad-hoc).

### Admin / Dispatcher
- **Bandeja de solicitudes** (Kanban por estado o tabla con filtros).
- **Vista de calendario/agenda** (día/semana) con las citas y bloqueos;
  asignación y reprogramación.
- **Panel de despacho de emergencia** (ambulancia): un clic, selección rápida
  de unidad, arranca el reloj de SLA.
- **Capacidades de vehículo** en el catálogo (`isAmbulance`, etc.).
- KPIs de citas en el **dashboard ejecutivo** ya existente (tarjetas nuevas:
  pendientes de aprobar, SLA ambulancia, no-shows de la semana).

---

## 8. Trazabilidad, seguridad y notificaciones

- **Auditoría**: toda acción de admin (aprobar, rechazar, asignar,
  reprogramar, override de emergencia) escribe en el `AuditLog` existente +
  `RequestEvent`. La cadena solicitud → viaje queda completamente trazada.
- **Ambulancia/clínico**: los campos de paciente son sensibles → acceso
  restringido a ADMIN/DISPATCHER y al conductor asignado; no se exponen en
  listados generales. Considerar minimización de datos.
- **Notificaciones**: además de Telegram, conviene **Web Push in-app** para que
  el dispatcher reciba solicitudes nuevas y emergencias en tiempo real.
- **Formulario público** (si se habilita): Cloudflare Turnstile + rate-limit.

---

## 9. Impacto en D1 / Cloudflare (consistente con lo ya migrado)

- Enums nuevos → **`String`** (SQLite/D1 no soporta enums), con valores
  documentados en comentarios (igual que el resto del esquema).
- Campos JSON (`metadata`) → **TEXT** codificado con los helpers
  `toJson/fromJson` ya existentes.
- Transacciones → **batch `$transaction([...])`** (D1 no soporta transacciones
  interactivas), igual que se corrigió en `tripService`.
- Migración aditiva: nuevas tablas + columnas nuevas con default → sin romper
  datos existentes (`prisma migrate diff` genera el `0002_*.sql`).

---

## 10. Plan de implementación por fases

| Fase | Contenido | Resultado |
|---|---|---|
| **1. Núcleo de citas (STANDARD)** | Modelo `TransportRequest` + `RequestEvent`, formulario de solicitud, bandeja admin, aprobar/asignar/despachar→Trip, hook de `COMPLETED`. Rol `REQUESTER`. | Solicitar y agendar transporte estándar, ejecutándose como viaje. |
| **2. Agenda y disponibilidad** | `ScheduleBlock`, helper de disponibilidad, vista de calendario, reprogramación, detección de conflictos. | Verdadera gestión de agenda con sugerencia de slots. |
| **3. Ambulancias** | Capacidades de vehículo, bloque clínico, prioridad, **despacho de emergencia + SLA**, auditoría reforzada, templates Telegram. | Gestión de ambulancias con trazabilidad y emergencia inmediata. |
| **4. Mejoras transversales** | Web Push, reportes/exportación (CSV/PDF), KPIs de citas en dashboard, PWA/offline para conductores. | Operación completa y robusta. |

> Las decisiones de producto de esta sesión ubican el **despacho de emergencia
> de ambulancia** en la Fase 3, y mantienen desde la Fase 1 el **flujo ad-hoc**
> (iniciar viaje sin cita) intacto.

---

## 11. Otras mejoras recomendadas (fuera del módulo de citas)

Priorizadas por impacto / esfuerzo:

1. 🔔 **Notificaciones in-app + Web Push** (dispatchers y conductores).
2. 📱 **PWA + modo offline** para conductores en ruta.
3. 📄 **Reportes y exportación** (CSV/PDF de viajes, combustible, SLA).
4. 🔧 **Mantenimiento de vehículos** (odómetro, alertas de servicio) — crítico
   con ambulancias.
5. ✅ **Checklist pre-viaje** (inspección de unidad), especialmente ambulancia.
6. 🔐 **Hardening**: Turnstile en login/formulario, rate-limiting, completar el
   **reset de contraseña** (la tabla `PasswordReset` ya existe sin usar).
7. 🗺️ **Mapa en vivo** de unidades activas (si se captura GPS periódico).
