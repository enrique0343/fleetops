# Citas de Transporte — Ampliación v2

> Complemento de `APPOINTMENTS_MODULE_DESIGN.md`. Incorpora los requerimientos:
> 1. El **profesional ve la disponibilidad de ambulancias** al solicitar, con
>    **fallback a proveedor externo (outsourcing)** si no hay unidad interna.
> 2. **Configurar vehículos como ambulancia** y **horarios de servicio**
>    configurables (para transporte administrativo y para ambulancias).
> 3. **Pool de tareas** (varias diligencias) que se agrupan en una **ruta
>    optimizada multi-parada** para el conductor.
> 4. **GPS / ruteo gratuito** estilo Waze (OpenStreetMap), con un enfoque
>    **híbrido**: motor de ruteo (solver) para el cálculo exacto + Claude/MCP
>    para el razonamiento y la orquestación.
> 5. **Auto-despacho de emergencia sin cita**, también para vehículos no
>    ambulancia.

---

## 1. Disponibilidad visible para el solicitante + fallback a outsourcing

### Por qué importa
El profesional necesita decidir **informado**: si hay ambulancia interna,
solicita; si **no la hay**, debe poder **derivar a un proveedor externo** sin
salir del sistema, dejando la trazabilidad de esa decisión. Esto evita
reprocesos y cubre el hueco operativo/legal.

### Flujo
```
Profesional abre formulario de ambulancia
        │
        ▼
Sistema consulta disponibilidad EN VIVO  (GET /api/requests/availability)
        │
   ┌────┴───────────────┐
   ▼                    ▼
Hay unidad interna   NO hay unidad interna (o fuera de horario)
   │                    │
Solicita normal      El formulario ofrece explícitamente:
(PENDING)              (a) ponerse en cola igual (PENDING, con aviso)
                      (b) "Derivar a proveedor externo" → ExternalReferral
                          con motivo: NO_UNIT | OUT_OF_HOURS | ALL_BUSY
```

### Vista del solicitante
- **Semáforo de disponibilidad** en el formulario: 🟢 N unidades libres ahora /
  🟡 libre en HH:MM / 🔴 sin disponibilidad.
- Lista de **próximas ventanas libres** (slots) calculadas con la lógica de
  disponibilidad (ver doc base §5) **restringida a horarios de servicio**.
- Si 🔴: botón **"Derivar a proveedor externo"** con datos de contacto del
  outsourcing configurado.

### Entidad nueva: `ExternalReferral` (derivación a outsourcing)
```
id              String   @id @default(uuid())
requestId       String?                  // si nació de una solicitud
serviceType     String                   // normalmente AMBULANCE
providerId      String?                  // FK ExternalProvider (catálogo)
providerName    String                   // copia legible
reason          String                   // NO_UNIT | OUT_OF_HOURS | ALL_BUSY | OTHER
patientName     String?                  // si aplica (clínico, acceso restringido)
notes           String?
status          String   @default("REFERRED") // REFERRED | CONFIRMED | CANCELLED
referredById    String
referredAt      DateTime @default(now())
```

### Catálogo nuevo: `ExternalProvider` (proveedores outsourcing)
```
id          String  @id @default(uuid())
name        String
serviceType String                        // AMBULANCE | STANDARD | BOTH
phone       String?
contactName String?
coverageNote String?
isActive    Boolean @default(true)
```

> La derivación **no genera Trip interno**, pero sí queda en `AuditLog` +
> `RequestEvent` (tipo `REFERRED_EXTERNAL`). Así el indicador "demanda no
> cubierta por flota interna" alimenta decisiones (¿comprar otra ambulancia?).

---

## 2. Configuración de vehículos y horarios de servicio

### Vehículos como ambulancia (ya en doc base, se añade UI)
`Vehicle`: `isAmbulance`, `hasStretcher`, `hasOxygen` (+ se sugiere
`serviceClass`: `ADMIN` | `AMBULANCE` | `CARGO` para filtrar selección).
- Pantalla admin: marcar capacidades por unidad. Solo unidades con
  `isAmbulance = true` aparecen como elegibles para solicitudes de ambulancia.

### Horarios de servicio configurables: `ServiceWindow`
Define **cuándo** se ofrece cada tipo de servicio (p. ej. transporte
administrativo L-V 8:00-17:00; ambulancia 24/7). Alimenta los "slots" que ve
el solicitante y restringe la agenda.
```
id          String  @id @default(uuid())
serviceType String                        // STANDARD | AMBULANCE
branchId    String?                        // alcance opcional por sucursal
dayOfWeek   Int                            // 0..6 (0=domingo)
startTime   String                         // "08:00"
endTime     String                         // "17:00"
slotMinutes Int     @default(30)           // granularidad de los slots
isActive    Boolean @default(true)
```
> Un servicio 24/7 = 7 filas cubriendo 00:00-23:59. La disponibilidad de §1
> intersecta: (recurso libre) ∩ (dentro de `ServiceWindow`) ∩ (sin
> `ScheduleBlock`).

---

## 3. Pool de tareas + Ruta multi-parada

### Concepto
En lugar de un viaje = un origen→destino, se acumula un **pool de tareas**
("deja documento en A", "recoge en B", "entrega en C"). El sistema **agrupa**
tareas compatibles y genera una **ruta optimizada** (orden de paradas) para que
el conductor haga todas las diligencias en un solo recorrido eficiente.

```
Tareas sueltas (pool)            Agrupación + optimización           Ruta
─────────────────────            ─────────────────────────          ──────────
Task A (dejar doc, dir X)  ┐                                    1. Base
Task B (recoger, dir Y)    ├──► RouteOptimizer (solver) ──►     2. Y (recoger)
Task C (entregar, dir Z)   ┘     ordena por cercanía/ventana    3. X (dejar)
                                  + ventanas horarias            4. Z (entregar)
                                                                 5. Base
```

### Entidades nuevas

#### `TransportTask` — una diligencia atómica
```
id            String   @id @default(uuid())
code          String   @unique
type          String                       // DROPOFF | PICKUP | DELIVERY | VISIT
requesterId   String?
requesterName String
locationId    String                        // FK Location (o lat/lng libre)
addressText   String?
lat           Float?
lng           Float?
notes         String?
priority      String   @default("NORMAL")   // NORMAL | HIGH
windowStart   DateTime?                      // ventana horaria opcional
windowEnd     DateTime?
serviceTimeMin Int     @default(5)           // minutos estimados en sitio
status        String   @default("POOL")      // POOL | ASSIGNED | EN_ROUTE | DONE | CANCELLED
routeId       String?                        // FK RoutePlan cuando se agrupa
tripId        String?                        // FK Trip que la ejecutó
createdAt     DateTime @default(now())
```

#### `RoutePlan` — un conjunto ordenado de tareas para un conductor/vehículo
```
id            String   @id @default(uuid())
code          String   @unique
driverId      String?
vehicleId     String?
status        String   @default("DRAFT")     // DRAFT | DISPATCHED | IN_PROGRESS | DONE
plannedDate   DateTime
totalDistanceKm Float?
totalDurationMin Int?
optimizedOrder String?                        // JSON: [taskId, taskId, ...] (TEXT en D1)
optimizerMeta  String?                        // JSON: motor usado, métricas
tripId        String?  @unique                // Trip generado al despachar
createdById   String
createdAt     DateTime @default(now())
```

### Cómo se ejecuta
- Un `RoutePlan` despachado **genera un `Trip`** (reutiliza el lifecycle) y cada
  parada se refleja como evento (`ARRIVE_STOP`/`RESUME_TRIP`) al estilo actual.
- El conductor ve la **lista ordenada de paradas** y un botón por parada:
  **"Navegar"** (deep-link a Waze/Google Maps) + **"Marcar hecha"**.

---

## 4. GPS y ruteo — 100% gratuito + híbrido con Claude/MCP

### Principio de diseño (importante)
> **El cálculo de la ruta óptima lo hace un MOTOR DE RUTEO (solver), no un
> LLM.** Un modelo de lenguaje puede equivocarse con distancias; un solver da
> resultado exacto y reproducible. **Claude/MCP aporta el RAZONAMIENTO**:
> interpretar tareas en lenguaje natural, agrupar lo compatible, fijar
> prioridades y *orquestar* el solver. Es un **híbrido**, no uno u otro.

### Stack gratuito (sin tarjeta de crédito)
| Necesidad | Herramienta gratis | Nota |
|---|---|---|
| Mapa en pantalla | **Leaflet + tiles OpenStreetMap** | Sin costo, atribución OSM |
| Geocodificación (dirección→coord) | **Nominatim (OSM)** | Respetar rate-limit; cachear |
| Distancias/tiempos reales | **OSRM** (self-host o demo) | Matriz de distancias |
| Optimización multi-parada (orden) | **VROOM** / **OpenRouteService** | Resuelve TSP/VRP; ORS tiene API key gratuita |
| Navegación giro-a-giro | **Deep-link a Waze/Google Maps** | App nativa del móvil del conductor |

Deep-links (gratis, abren la app del conductor):
```
Waze:         https://waze.com/ul?ll=<lat>,<lng>&navigate=yes
Google Maps:  https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>
              &waypoints=<lat1>,<lng1>|<lat2>,<lng2>   (multi-parada)
```

### Arquitectura del optimizador (en el Worker de Cloudflare)
```
POST /api/routes/optimize
   body: { taskIds: [...], driverId?, vehicleId?, date }
        │
        ▼
1) Geocodificar tareas sin coords (Nominatim, cacheado en D1)
2) Construir matriz de distancias (OSRM /table)
3) Resolver orden óptimo (VROOM/ORS) respetando ventanas horarias
4) (Opcional) Capa Claude/MCP: ajustar prioridades, explicar la ruta,
   resolver ambigüedades de las tareas en lenguaje natural
5) Guardar RoutePlan.optimizedOrder + métricas
        │
        ▼
   Devuelve ruta ordenada + distancia/tiempo + deep-links por parada
```

### Rol del MCP / agente Claude (capa de razonamiento)
- **Entrada en lenguaje natural**: "lleva estos papeles al ministerio y de paso
  recoge el paquete cerca" → Claude extrae tareas, infiere tipo y prioridad.
- **Agrupación inteligente**: decide qué tareas entran en una misma ruta según
  zona, ventana horaria y capacidad del vehículo, y **llama al solver** para el
  orden exacto.
- **Explicabilidad**: genera un resumen ("primero Y porque cierra a las 13:00").
- **Se puede exponer como un MCP server propio** (`fleetops-routing`) que
  encapsule OSRM/VROOM como *tools*, de modo que el agente las invoque. Así el
  cálculo sigue siendo determinista y Claude solo orquesta.

> Resultado: el **usuario interno es más autónomo** (arma su propia ruta lógica)
> y **se le quita carga al administrador**, que ya no decide rutas a mano.

---

## 5. Auto-despacho de emergencia sin cita (no solo ambulancia)

Extiende el flujo ad-hoc actual con una variante **urgente** para cualquier
vehículo, no solo ambulancias.

- En la app del conductor / del usuario interno: botón **"Viaje urgente sin
  cita"** → arranca un `Trip` inmediato con:
  - `priority = URGENT`
  - **motivo obligatorio** (texto) y registro de quién lo autoriza/inicia.
  - evento `EMERGENCY_SELF_DISPATCH` en la bitácora + `AuditLog`.
- No requiere aprobación previa (para no frenar la urgencia), pero queda
  **100% trazado** para revisión posterior.
- Diferencia con ambulancia-emergencia: misma mecánica, distinto `serviceType`
  y sin datos clínicos obligatorios.

---

## 6. Entidades nuevas — resumen

| Entidad | Propósito |
|---|---|
| `ExternalProvider` | Catálogo de proveedores outsourcing (ambulancia/estándar) |
| `ExternalReferral` | Derivación a proveedor externo cuando no hay flota interna |
| `ServiceWindow` | Horarios de servicio configurables por tipo/sucursal |
| `TransportTask` | Diligencia atómica (pool de tareas) |
| `RoutePlan` | Conjunto ordenado de tareas → genera un Trip |

Extensiones: `Vehicle.serviceClass`; `Trip` ya enlaza `requestId` y ahora
también `RoutePlan.tripId`.

---

## 7. API nueva (resumen)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/requests/availability?serviceType=AMBULANCE&at=...` | Disponibilidad en vivo + próximos slots (consumido por el formulario del profesional) |
| `POST` | `/api/referrals` | Crear derivación a outsourcing |
| `GET/POST/PATCH` | `/api/providers` | Catálogo de proveedores externos (admin) |
| `GET/POST/PATCH` | `/api/service-windows` | Horarios de servicio (admin) |
| `GET/POST` | `/api/tasks` | Pool de tareas (crear/listar) |
| `POST` | `/api/routes/optimize` | Optimizar ruta multi-parada (solver + Claude) |
| `POST` | `/api/routes/:id/dispatch` | Despachar RoutePlan → genera Trip |
| `GET` | `/api/routes/:id/navigation` | Deep-links de navegación por parada |

---

## 8. Frontend nuevo (resumen)

- **Formulario de ambulancia con semáforo de disponibilidad** + opción de
  derivar a externo.
- **Formulario de transporte administrativo** que muestra **slots libres**
  configurados (evita reprocesos).
- **Tablero de pool de tareas** (admin): seleccionar tareas → "Optimizar ruta"
  → previsualizar orden en mapa Leaflet → despachar.
- **Vista de conductor con ruta ordenada**: lista de paradas con "Navegar"
  (Waze/Maps) y "Marcar hecha".
- **Catálogos admin**: proveedores externos, horarios de servicio, capacidades
  de vehículo.

---

## 9. Consideraciones Cloudflare / D1 (consistencia)

- Enums nuevos → `String`; JSON (`optimizedOrder`, `optimizerMeta`) → TEXT con
  `toJson/fromJson`.
- Geocodificación cacheada en D1 para no exceder rate-limits de Nominatim.
- Llamadas a OSRM/VROOM/ORS vía `fetch` desde el Worker (igual que Telegram).
- Si se self-hostea OSRM/VROOM: contenedor aparte (fuera de Cloudflare); el
  Worker solo lo consume. Alternativa sin infra: API gratuita de
  OpenRouteService (clave gratuita).
- El **MCP de ruteo** puede correr como servicio aparte y exponer tools al
  agente; el Worker llama al resultado. Mantiene el cálculo determinista.

---

## 10. Plan de implementación actualizado

| Fase | Contenido |
|---|---|
| **1. Núcleo de citas (STANDARD)** | TransportRequest, formulario, bandeja admin, asignar/despachar→Trip (doc base). |
| **2. Agenda + horarios + disponibilidad visible** | `ServiceWindow`, slots, **semáforo de disponibilidad en el formulario**, calendario admin. |
| **3. Ambulancias + outsourcing** | Capacidades de vehículo, bloque clínico, **disponibilidad de ambulancia para el profesional**, `ExternalProvider`/`ExternalReferral`, despacho de emergencia + SLA. |
| **4. Pool de tareas + ruteo** | `TransportTask`, `RoutePlan`, optimizador (OSRM/VROOM), mapa Leaflet, deep-links de navegación. |
| **5. Capa Claude/MCP + autonomía** | MCP `fleetops-routing`, entrada en lenguaje natural, agrupación inteligente, explicabilidad. Auto-despacho urgente sin cita. |
| **6. Transversales** | Web Push, reportes/SLA, PWA offline, mantenimiento de vehículos, checklist pre-viaje, hardening. |

> Nota de viabilidad económica: **todo el stack de mapas/ruteo es gratuito**
> (OSM/Leaflet/OSRM/VROOM/ORS y deep-links a Waze/Maps). El único costo
> potencial es self-hostear OSRM/VROOM (un contenedor pequeño) si no se usa la
> API gratuita de OpenRouteService.
