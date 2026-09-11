# Seguimiento del conductor

La tarjeta aparece durante cualquier viaje activo en `/driver`. Usa el GPS
local para actualizar la posición sin esperar el refresco del recorrido.
El mapa conserva la consulta del trayecto guardado cada minuto.

- Avance: reducción de la distancia en línea recta entre origen y destino.
  Es una aproximación de cercanía, no kilómetros por carretera ni ETA.
  Puede disminuir en desvíos; nunca finaliza el viaje automáticamente.
- Si faltan coordenadas de destino o inicio, no inventa un porcentaje.
- `watchPosition` actualiza la pantalla; los envíos al endpoint existente
  `/trips/:id/ping` mantienen un intervalo mínimo de 30 segundos.
- Se ignoran posiciones inválidas, anteriores a la última captura,
  de más de 45 segundos o con precisión peor que 200 metros.
- Sin red se conserva la posición local; se reintenta con una captura reciente.
  No se implementó una cola durable de ubicaciones fuera de línea.
- Al terminar el viaje o abandonar la pantalla se libera el GPS.
  La versión web requiere mantener FleetOps abierto; no garantiza rastreo
  con la pantalla bloqueada o la aplicación cerrada.
- Inicio y fin ahora envían `startLat/startLng` y `endLat/endLng`, los campos
  que ya espera el Worker. No cambia el esquema ni requiere migración.

## Verificación

Desde `frontend/`:

```sh
npm ci
npm run test:tracking
npm run build
node design/build-driver-progress-demo.mjs /ruta/FleetOps-seguimiento-conductor.html
```

La vista previa empaqueta el componente real con datos simulados y controles
de avance, estado y señal. No usa GPS ni accede al servidor. El empaquetador
esbuild está incluido en las dependencias de Vite existentes.

Las pruebas cubren estimación, ausencia de coordenadas, límites de envío,
capturas antiguas, pérdida de señal, fallos de red y cierre del observador.
Queda pendiente comprobar permisos, reanudación al volver a la aplicación y
consumo de batería en un teléfono real con un viaje de prueba autorizado.
