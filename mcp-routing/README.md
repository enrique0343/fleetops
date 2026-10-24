# fleetops-routing — MCP server

Servidor [MCP](https://modelcontextprotocol.io) que expone **optimización de
rutas multi-parada determinista** como herramientas, para que un agente (Claude)
pueda **orquestar y explicar** rutas sin alucinar distancias.

> Principio de diseño: el agente razona (qué agrupar, prioridades, explicación),
> el **motor calcula** (orden y distancias exactas). Es un híbrido, no uno u otro.

## Herramientas expuestas

| Tool | Qué hace |
|---|---|
| `optimize_route` | Orden óptimo de visita (TSP multi-parada). OSRM si está configurado; si no, heurística nearest-neighbor sobre distancia great-circle. |
| `build_navigation` | Deep-links gratuitos a Waze y Google Maps (incluye un enlace multi-parada). |
| `geocode_address` | Dirección de texto → coordenadas (OpenStreetMap Nominatim). |
| `distance_matrix` | Matriz de distancias por pares (km), para explicar decisiones de agrupación. |

## Instalación

```bash
cd mcp-routing
npm install
npm run build
```

## Variables de entorno (opcionales)

| Var | Descripción |
|---|---|
| `OSRM_URL` | Motor de ruteo OSM (ej. `https://router.project-osrm.org`). Sin esto se usa la heurística offline. |
| `NOMINATIM_URL` | Endpoint de geocodificación (por defecto el público de OSM; respeta rate-limits). |

## Conectar a Claude Code / Claude Desktop

Añade a tu configuración MCP (`.mcp.json` del proyecto o config del cliente):

```json
{
  "mcpServers": {
    "fleetops-routing": {
      "command": "node",
      "args": ["./mcp-routing/dist/index.js"],
      "env": {
        "OSRM_URL": "https://router.project-osrm.org"
      }
    }
  }
}
```

(En desarrollo puedes usar `"command": "npx", "args": ["tsx", "./mcp-routing/src/index.ts"]`.)

## Ejemplo de uso por el agente

> "Tengo que dejar un documento en el Ministerio, recoger un paquete en la Zona
> Industrial y entregar en la Clínica Norte. Ármame la ruta más eficiente."

El agente:
1. Llama `geocode_address` para cada lugar sin coordenadas.
2. Llama `optimize_route` con las paradas → obtiene orden y distancia exactos.
3. Llama `build_navigation` → entrega los enlaces de Waze/Maps al conductor.
4. Explica el porqué del orden (usando `distance_matrix` si hace falta).

## Relación con el backend

El Worker de FleetOps ya incluye la misma lógica en `worker/src/services/
routingService.ts` (para el endpoint `/api/routes/optimize`). Este MCP expone el
motor de forma **independiente del backend**, para flujos conversacionales y
para que el agente combine ruteo con otras herramientas.
