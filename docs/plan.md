# Plan de Mejoras — tv3 Dashboard de Futuros
> Generado: 2026-05-25  
> Basado en evaluación de trader cuantitativo + revisión de código senior

---

## Índice
1. [P1 — Calidad de señal en ScalpingDecisionRibbon](#p1)
2. [P2 — Risk Guard en TradeTicket](#p2)
3. [P3 — Confidence Score en detección de spoofing](#p3)
4. [P4 — Alerta de datos stale / latencia](#p4)
5. [P5 — Fix bug SVG rect width negativo](#p5)
6. [P6 — Migrar socket a factory pattern con cleanup](#p6)
7. [P7 — Estandarizar schema CVD desde el backend](#p7)
8. [P8 — Activar Send Order con feature flag](#p8)

---

## P1 — Calidad de señal en ScalpingDecisionRibbon {#p1}
**Prioridad:** Crítica  
**Archivo:** `src/features/futures/ui/components/ScalpingDecisionRibbon.jsx`

### Problema
La señal actual usa únicamente:
- Suma CVD últimas 10 velas > 0 → BUY
- Imbalance > 0.15 → BUY

Sin filtro de régimen, sin confirmación de vela cerrada, sin volatility filter. Win-rate teórico ≈ 50% en condiciones de rango.

### Tareas
- [ ] Agregar campo `spreadBps` como prop (calculado desde `orderBook.spreadPct`).
- [ ] Bloquear señal (mostrar `NEUTRAL`) si `spreadBps > umbral configurable` (e.g. 5 bps).
- [ ] Requerir **doble confirmación**: CVD positivo **Y** imbalance positivo para generar `BUY`; ambos negativos para `SELL`; cualquier combinación mixta → `NEUTRAL`.
- [ ] Agregar prop `minDeltaThreshold` con valor por defecto (`500`) para ignorar deltas de ruido.
- [ ] Mostrar en el ribbon el estado del spread como pill adicional: `Spread: Xbps` con color warning si es alto.
- [ ] Extraer los umbrales (`0.15`, `10`) a constantes con nombre descriptivo en la parte superior del archivo.

### Criterio de aceptación
El ribbon nunca muestra BUY/SELL cuando el spread supera el umbral, y requiere confirmación en ambas dimensiones.

---

## P2 — Risk Guard en TradeTicket {#p2}
**Prioridad:** Crítica  
**Archivo:** `src/features/futures/ui/components/TradeTicket.jsx`  
**Archivo nuevo:** `src/features/futures/domain/riskCalculator.js`

### Problema
El ticket valida contra TradingRules del exchange (tick size, lot size, notional mínimo) pero no gestiona riesgo de la cuenta. Un trader puede enviarse ordenes sobredimensionadas sin ningún aviso.

### Tareas
- [ ] Crear `src/features/futures/domain/riskCalculator.js` con función pura:
  ```js
  // calcRiskAdjustedQty(params) → { qty, riskUsd, rMultiple }
  // params: { balance, riskPct, entryPrice, stopPrice, tickSize, stepSize }
  ```
- [ ] Agregar campos al formulario del ticket:
  - `Account Balance (USDT)` — input numérico
  - `Risk %` — slider 0.1% → 5% (default 1%)
  - `Stop Price` — input numérico (requerido si `riskPct` > 0)
- [ ] Al cambiar `riskPct` o `stopPrice`, calcular y mostrar en tiempo real:
  - Quantity sugerida (redondeada al `stepSize`)
  - Riesgo en USD
  - Ratio Riesgo/Recompensa si hay precio target
- [ ] Integrar `calcRiskAdjustedQty` dentro de `useValidateFuturesOrder` como validación adicional.
- [ ] Mostrar `Alert` de warning si la qty ingresada manualmente supera la qty sugerida en > 2x.

### Criterio de aceptación
El usuario puede operar con gestión de riesgo por porcentaje de cuenta. La qty se auto-calcula pero es editable.

---

## P3 — Confidence Score en detección de spoofing {#p3}
**Prioridad:** Alta  
**Archivo backend:** `tv1/src/domain/futures/services/SpoofingDetectorService.js`  
**Archivo frontend:** `src/features/futures/ui/components/SpoofingAlertsPanel.jsx`

### Problema
Los eventos de spoofing no tienen score de confianza. El trader no puede distinguir entre una señal sólida (alto volumen, cancelación rápida, múltiples instancias) y un falso positivo (orden pequeña cancelada por ajuste legítimo).

### Tareas

**Backend:**
- [ ] Agregar campo `confidence` (0–1) al objeto `SpoofingEvent` calculado como:
  ```
  confidence = w1 * (peakQty / avgOrderBookQty)
             + w2 * (1 - lifespanMs / MAX_LIFESPAN)
             + w3 * (distanceFromMidBps < CLOSE_THRESHOLD ? 1 : 0)
  ```
  Normalizado a [0, 1]. Pesos iniciales sugeridos: `w1=0.4, w2=0.4, w3=0.2`.
- [ ] Agregar campo `distanceFromMidBps` al evento.
- [ ] Agregar campo `relativeSize` (peakQty / tamaño promedio del libro en ese nivel).

**Frontend:**
- [ ] Agregar columna `Conf.` en `SpoofingAlertsPanel` con barra de progreso coloreada:
  - < 0.4 → gris (baja)
  - 0.4–0.7 → amarillo (media)
  - \> 0.7 → naranja/rojo (alta)
- [ ] Agregar filtro en el panel: `Min confidence` slider.
- [ ] En `ScalpingDecisionRibbon`, usar solo eventos con `confidence > 0.6` para el conteo de `spoofingCount`.

### Criterio de aceptación
El panel muestra confidence por evento. El ribbon solo alerta sobre spoofing de alta confianza.

---

## P4 — Alerta de datos stale / latencia {#p4}
**Prioridad:** Alta  
**Archivos:** `src/features/futures/ui/components/MarketDataStatusBar.jsx`, `RealtimeStatusBadge.jsx`

### Problema
`health.lastUpdateAgeMs` se trackea pero no hay alerta visible cuando los datos están desactualizados. En un flash crash o desconexión parcial, el trader puede ver precios stale.

### Tareas
- [ ] En `MarketDataStatusBar`, agregar lógica de nivel de alerta:
  ```
  < 300ms   → verde  "Live"
  300–800ms → amarillo  "Delayed Nms"
  800–2000ms → naranja  "Slow Nms"
  > 2000ms  → rojo parpadeante  "Data Stale — Nms"
  ```
- [ ] Cuando el estado sea `> 2000ms`, deshabilitar los botones BUY/SELL en `TradeTicket` y mostrar tooltip `"Market data too old to trade safely"`.
- [ ] Agregar a `EMPTY_HEALTH` un campo `dataFreshness: 'live' | 'delayed' | 'slow' | 'stale'` calculado en el reducer.
- [ ] Exponer `health.lastUpdateAgeMs` como dato visible en el ribbon (pill `Age: Xms`).

### Criterio de aceptación
El trader siempre sabe en ms la edad del último dato. El ticket se bloquea automáticamente si los datos son stale.

---

## P5 — Fix bug SVG rect width negativo {#p5}
**Prioridad:** Alta  
**Archivos a investigar:** `CandleOverlayLayerD3.jsx`, `DepthChartD3.jsx`, `LiquidityHeatmapD3.jsx`

### Problema
Console error en producción:
```
Error: <rect> attribute width: A negative value is not valid. ("-88")
```
Ocurre cuando el spread es extremo o cuando los datos del book son parciales. Los charts pueden quedar en blank o distorsionados.

### Tareas
- [ ] Buscar todas las asignaciones `.attr('width', expr)` en los archivos D3 del proyecto.
- [ ] Envolver cada cálculo de ancho con `Math.max(0, expr)`.
- [ ] Buscar igualmente `.attr('height', expr)` y aplicar el mismo guard.
- [ ] Agregar a `marketDataGuards.js` una función helper:
  ```js
  export function safeDimension(value, fallback = 0) {
    const n = typeof value === 'number' && isFinite(value) ? value : fallback;
    return Math.max(0, n);
  }
  ```
- [ ] Reemplazar los cálculos directos en los componentes D3 con `safeDimension(...)`.

### Criterio de aceptación
Zero console errors SVG en cualquier condición de mercado (spread extremo, book vacío, datos parciales).

---

## P6 — Migrar socket a factory pattern con cleanup {#p6}
**Prioridad:** Media  
**Archivo:** `src/features/futures/infrastructure/futuresSocketClient.js`  
**Archivo:** `src/features/futures/application/FuturesRealtimeContext.jsx`

### Problema
El socket es un singleton de módulo (`let socket = null`). Consecuencias:
- Si el auth token cambia, el socket no se re-autentica.
- Hot reload en desarrollo puede dejar sockets huérfanos.
- No testeable de forma aislada.
- El `FuturesRealtimeProvider` no destruye el socket en su unmount.

### Tareas
- [ ] Cambiar `futuresSocketClient.js` para exportar una función `createSocketClient(options)` que retorne un objeto con `{ subscribe, unsubscribe, on, off, onConnectionChange, destroy }`.
- [ ] Eliminar la variable de módulo `let socket = null`.
- [ ] En `FuturesRealtimeProvider`, crear la instancia en un `useRef` dentro del `useEffect` de setup:
  ```js
  const clientRef = useRef(null);
  useEffect(() => {
    clientRef.current = createSocketClient({ url: SOCKET_URL, auth: buildAuth() });
    return () => clientRef.current?.destroy();
  }, []);
  ```
- [ ] Pasar `clientRef.current` a `useFuturesAssetRealtime` via contexto de acciones o como prop.
- [ ] Verificar que `destroy()` emita `disconnect` y cierre el socket limpiamente.

### Criterio de aceptación
Al desmontar el provider, el socket se cierra. Al re-montar, se crea uno nuevo con el token actualizado. No hay sockets huérfanos en DevTools.

---

## P7 — Estandarizar schema CVD desde el backend {#p7}
**Prioridad:** Media  
**Archivo backend:** `tv1/src/shared/contracts/futuresSocketEvents.js`  
**Archivo frontend:** `src/features/futures/infrastructure/futuresSocketEvents.js`

### Problema
`ScalpingDecisionRibbon` normaliza 5 nombres posibles para el campo delta del CVD:
```js
item?.delta ?? item?.cvdDelta ?? item?.volumeDelta ?? item?.netDelta ?? item?.value
```
Esto indica que el backend ha enviado el campo con nombres distintos en distintas versiones. Si el backend envía `0` en todos esos campos (bug silencioso), el ribbon calcula delta=0 sin error.

### Tareas
- [ ] Definir en `tv1/src/shared/contracts/futuresSocketEvents.js` el schema canónico del evento CVD:
  ```js
  // { symbol, delta, cumulativeDelta, timestamp }
  // campo: "delta" — único nombre aceptado
  ```
- [ ] Actualizar `CvdService.js` en el backend para emitir siempre el campo `delta`.
- [ ] En el frontend, actualizar `useCvdData.js` para esperar solo `event.delta` (sin normalización defensiva).
- [ ] Simplificar `sumRecentDelta` en `ScalpingDecisionRibbon` a una sola línea: `item?.delta ?? 0`.
- [ ] Agregar validación de schema en el handler del socket: si `delta` es `undefined`, loguear warning y descartar el evento.

### Criterio de aceptación
Un solo campo `delta` en el schema. Cualquier evento malformado es descartado y logueado, no silenciado.

---

## P8 — Activar Send Order con feature flag {#p8}
**Prioridad:** Media  
**Archivo:** `src/features/futures/ui/components/TradeTicket.jsx`  
**Archivo nuevo:** `src/config/featureFlags.js`

### Problema
`Send Order` está permanentemente deshabilitado con un comentario `"demo mode"`. No hay mecanismo para activarlo en producción sin modificar el código fuente.

### Tareas
- [ ] Crear `src/config/featureFlags.js`:
  ```js
  export const FEATURE_FLAGS = {
    LIVE_ORDER_EXECUTION: process.env.REACT_APP_ENABLE_LIVE_ORDERS === 'true',
  };
  ```
- [ ] En `TradeTicket.jsx`, reemplazar el `disabled` hardcodeado por:
  ```js
  import { FEATURE_FLAGS } from '../../../../config/featureFlags';
  // ...
  disabled={!isValid || !FEATURE_FLAGS.LIVE_ORDER_EXECUTION}
  ```
- [ ] Agregar banner de advertencia visible cuando `LIVE_ORDER_EXECUTION === true`:
  ```
  ⚠️ LIVE EXECUTION ENABLED — Orders will be sent to the exchange
  ```
- [ ] Documentar la variable de entorno en `README.md` de tv3.
- [ ] Implementar la función `sendOrder` en `futuresApiClient.js` (POST a `/api/futures/orders`).

### Criterio de aceptación
Por defecto `REACT_APP_ENABLE_LIVE_ORDERS` no está definida → botón deshabilitado. Con la variable = `"true"` → botón activo con banner de advertencia.

---

## Orden de ejecución sugerido

```
P5 (fix bug) → P4 (stale data) → P1 (señal) → P2 (risk guard) → P3 (confidence) → P6 (socket) → P7 (schema) → P8 (feature flag)
```

Los primeros dos son correcciones de defectos. Los siguientes tres mejoran directamente la utilidad para trading. Los últimos tres son mejoras de arquitectura y DX.

---

## Estimación de complejidad

| ID | Complejidad | Archivos nuevos | Archivos modificados |
|----|-------------|-----------------|----------------------|
| P1 | Baja        | 0               | 1                    |
| P2 | Alta        | 1               | 2                    |
| P3 | Media       | 0               | 3 (1 backend + 2 frontend) |
| P4 | Baja-Media  | 0               | 3                    |
| P5 | Baja        | 0               | 3-4                  |
| P6 | Alta        | 0               | 2                    |
| P7 | Media       | 0               | 4 (2 backend + 2 frontend) |
| P8 | Baja        | 1               | 2                    |
