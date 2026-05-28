# Plan de corrección — Timeframes coherentes y suscripciones modulares (tv3)

> Objetivo: alinear los streams realtime con el timeframe que el usuario está mirando,
> separar imbalance microestructural de imbalance por vela, y mover la arquitectura de
> "subscribe-all" a un modelo modular con lazy subscribe/unsubscribe por feature y por TF.

---

## 0. Diagnóstico verificado en código

Hallazgos confirmados leyendo el repo (no especulación):

| Punto | Archivo | Estado actual |
|---|---|---|
| INTERVALS UI | [src/features/futures/ui/state/useFuturesDashboardState.js](tv3-main/tv3-main/src/features/futures/ui/state/useFuturesDashboardState.js#L14) | `['1m','5m','15m','1h','4h']` ✅ |
| Subscribe default | [src/features/futures/infrastructure/futuresSocketClient.js](tv3-main/tv3-main/src/features/futures/infrastructure/futuresSocketClient.js#L43) | `intervals = ['1m','5m','15m']` ❌ |
| Hook realtime default | [src/features/futures/application/useFuturesAssetRealtime.js](tv3-main/tv3-main/src/features/futures/application/useFuturesAssetRealtime.js#L88) | `intervals = ['1m','5m','15m']` ❌ |
| Footprint default | [src/features/futures/application/useFootprintCandles.js](tv3-main/tv3-main/src/features/futures/application/useFootprintCandles.js#L26) | `['1m','5m','15m']` ❌ |
| CVD | [src/features/futures/application/useCvdData.js](tv3-main/tv3-main/src/features/futures/application/useCvdData.js) | Sin TF; flujo único `futures:orderflow:cvd` ⚠️ |
| Imbalance | [src/features/futures/application/useLiquidityData.js](tv3-main/tv3-main/src/features/futures/application/useLiquidityData.js#L92) | Calculado desde `book:local` (microestructura) — OK conceptual, pero mezclado en el dashboard sin distinción |
| Dashboard | [src/features/futures/ui/state/useFuturesDashboardState.js](tv3-main/tv3-main/src/features/futures/ui/state/useFuturesDashboardState.js#L23) | Llama `useFuturesAssetRealtime(symbol, INTERVALS)` y `useFootprintCandles(symbol, INTERVALS)` con TODOS los TFs siempre ❌ |
| Heatmap | mismo dashboard | Sólo gateado por `chartTab === 3` ✅ (único feature con lazy) |

**Conclusiones clave**:

1. Hoy se mandan los 5 TFs al servidor desde el dashboard, pero **el contrato de subscribe acepta el array tal cual** — el problema no es que el server ignore `1h/4h`, sino que cualquier otra ruta que llame `subscribeSymbol(symbol)` sin argumentos pierde `1h/4h` (defaults inconsistentes). Hay que **unificar la fuente de verdad**.
2. El hook realtime se subscribe a **todos los eventos siempre** (footprint, liquidity shift, spoofing, paper trades, etc.) sin importar qué pestaña esté activa.
3. CVD viene "agregado" del backend en un único stream sin TF — el frontend lo trata como serie temporal pero no puede pivotar entre TFs.
4. Imbalance del orderbook (microestructura, no-TF) está bien implementado en `useLiquidityData`, pero la UI y la nomenclatura no diferencian del "imbalance por vela" (delta/CVD agregado), generando confusión conceptual.

---

## 1. Principios de la corrección

1. **Una sola fuente de verdad para el set activo de TFs**: el dashboard decide, todos los hooks reciben.
2. **Subscribe = unión de lo que necesitan los features activos**, no un default cableado.
3. **Lazy subscribe por feature**: si la pestaña/widget no está montada, no se subscribe.
4. **Diferenciar dos familias de señales**:
   - *Microestructura* (no TF): orderbook, top-of-book imbalance, tape, spoofing, liquidity shifts, mark price, ticker.
   - *Velas* (por TF): candles, footprint, CVD agregado por vela, delta por vela.
5. **Un solo subscribe por símbolo al socket** con el set actual `{features, intervals}`; reemitirlo cuando cambie (debounced).

---

## 2. Cambios por fase

### Fase 1 — Unificar fuente de verdad de TFs e intervalos (rápido, bajo riesgo)

**Meta**: que `1h` y `4h` funcionen end-to-end sin tocar arquitectura.

- [x] Quitar defaults cableados `['1m','5m','15m']` de:
  - `subscribeSymbol` en [futuresSocketClient.js](tv3-main/tv3-main/src/features/futures/infrastructure/futuresSocketClient.js) → requiere `intervals` explícito; warning si viene vacío.
  - `useFuturesAssetRealtime` en [useFuturesAssetRealtime.js](tv3-main/tv3-main/src/features/futures/application/useFuturesAssetRealtime.js) → parámetro requerido (warn si falta).
  - `useFootprintCandles` en [useFootprintCandles.js](tv3-main/tv3-main/src/features/futures/application/useFootprintCandles.js) → ahora recibe un único `interval`.
- [x] Módulo neutral [domain/timeframes.js](tv3-main/tv3-main/src/features/futures/domain/timeframes.js) con `INTERVALS`, `isValidInterval`, `intervalToMs`. Dashboard re-exporta para compat.
- [x] Backend ([FuturesAssetSocketAdapter.js](tv1-main/tv1-main/src/infrastructure/adapters/inbound/websocket/FuturesAssetSocketAdapter.js)) fallback ampliado a `['1m','5m','15m','1h','4h']`. Binance soporta `kline_1h`/`kline_4h` nativamente — no se requiere mapping adicional.
- [ ] Smoke test manual: cambiar tab a `1h` y `4h` y confirmar candles realtime + recovery REST.

### Fase 2 — Separar conceptos: Orderbook Imbalance vs Candle Imbalance

**Meta**: dejar de mezclar microestructura con métricas por vela.

- [x] `useLiquidityData` ahora expone `orderbookImbalanceHistory` (alias explícito de `imbalanceHistory`) — el dashboard también lo expone. Migrar consumidores progresivamente.
- [ ] Crear `useCandleImbalance(symbol, interval)` (derivar delta/CVD por vela). Requiere backend Fase 3.
- [ ] En la UI, dos widgets distintos: `OrderbookImbalanceStrip` (no-TF) y `CandleImbalancePanel` (por TF). Pendiente UI.
- [ ] Borrar el "imbalance hardcodeado" que mezcla ambos del dashboard.

### Fase 3 — CVD timeframe-aware

**Meta**: que CVD respete el TF activo.

- [ ] **Backend** (tv1): emitir `futures:orderflow:cvd` con `interval` en el payload (o un stream `cvd:1m`, `cvd:5m`, ...). Acumular CVD por bucket de vela en `symbolWorker`.
- [x] **Frontend**: [useCvdData.js](tv3-main/tv3-main/src/features/futures/application/useCvdData.js) ahora acepta `interval`, filtra eventos por `(symbol, interval)` y registra feature `'cvd'`. Eventos sin `interval` (backend legacy) se aceptan como fallback.
- [ ] Pre-fetch REST de CVD histórico por TF al cambiar de TF (requiere endpoint backend).

### Fase 4 — Suscripciones modulares por feature

**Meta**: el socket sólo trae lo que la UI realmente muestra.

Diseño:

```text
SubscriptionPlan = {
  symbol,
  intervals: Set<'1m'|'5m'|...>,
  features: Set<'candles'|'orderbook'|'cvd'|'footprint'|'tape'|'heatmap'|'liquidity'|'signals'>,
}
```

- [x] Crear [application/subscriptions/useFeatureSubscription.js](tv3-main/tv3-main/src/features/futures/application/subscriptions/useFeatureSubscription.js): hook que registra `(symbol, feature, interval?)`; al desmontar desregistra.
- [x] Crear [application/subscriptions/subscriptionPlanStore.js](tv3-main/tv3-main/src/features/futures/application/subscriptions/subscriptionPlanStore.js) — Zustand store con refcount por feature, interval y feature|interval.
- [x] Crear [application/subscriptions/useSocketSubscriptionSync.js](tv3-main/tv3-main/src/features/futures/application/subscriptions/useSocketSubscriptionSync.js): observa el plan, diff vs último enviado, debounce 150 ms, emite `SUBSCRIBE_ASSET { symbol, intervals, features }` y `UNSUBSCRIBE_ASSET`.
- [x] Refactor de hooks de feature:
  - `useFootprintCandles(symbol, interval)` → registra `'footprint'` por TF activo.
  - `useCvdData(symbol, interval)` → registra `'cvd'` por TF.
  - `useLiquidityData(symbol, { heatmapEnabled })` → registra `'orderbookImbalance'` (siempre) y `'heatmap'` sólo si está habilitado.
  - `useFuturesAssetRealtime` → registra `'candles'` por cada interval + `'orderbook'`, `'ticker'`, `'trades'`. No emite subscribe directo.
- [ ] **Backend** (tv1): aceptar `features` en `SUBSCRIBE_ASSET` (hoy lo ignora) y gatear emisión por feature activa. **Importante**: backend actual es idempotente por símbolo en `_onSubscribe` — un segundo subscribe del mismo socket no abre nuevos streams. Para que `intervals` deltas funcionen, hay que aceptar diffs en re-subscribe. Mientras tanto, el dashboard manda `INTERVALS` completos en el primer subscribe.

### Fase 5 — Lazy mount en UI

**Meta**: que las pestañas no montadas no registren features.

- [x] Confirmado: paneles de chartTab y flowTab usan render condicional `{tab === N && <Panel/>}` — desmonta dispara unsubscribe.
- [x] Containers ahora registran su propia feature:
  - [TapeReaderContainer.jsx](tv3-main/tv3-main/src/features/futures/ui/containers/TapeReaderContainer.jsx) → `'tape'`.
  - [CvdChartContainer.jsx](tv3-main/tv3-main/src/features/futures/ui/containers/CvdChartContainer.jsx) → `'cvd'` por TF activo.
  - [OrderFlowChartContainer.jsx](tv3-main/tv3-main/src/features/futures/ui/containers/OrderFlowChartContainer.jsx) → `'orderflow'`.
- [x] `activeInterval` propagado a `MarketFlowBottomSection` para que CVD herede el TF.

### Fase 6 — Backpressure y observabilidad

**Meta**: visibilidad de qué features están activas y cuánto trafican.

- [x] `useSocketSubscriptionSync` emite métrica `subscription.churn` por cada subscribe/unsubscribe efectivo (a través de `realtimeMetricsStore.recordEvent`).
- [x] Panel debug [SubscriptionPlanDebugPanel.jsx](tv3-main/tv3-main/src/features/futures/observability/SubscriptionPlanDebugPanel.jsx) muestra plan vivo (features y intervals con refcount) por símbolo. Pendiente mount detrás de flag dev.
- [ ] Test de regresión: cambiar TF 10 veces no debe disparar más de 1 subscribe efectivo (debounce 150 ms ya implementado).

### Fase 7 — Multi-símbolo (preparación)

**Meta**: dejar listo para BTC + ETH + SOL + XRP sin explotar.

- [x] `subscriptionPlanStore` ya guarda `Map<symbol, Plan>` independiente por símbolo.
- [x] [useSocketSubscriptionSyncMany.js](tv3-main/tv3-main/src/features/futures/application/subscriptions/useSocketSubscriptionSyncMany.js) itera símbolos y crea un sync independiente para cada uno (con debounce propio).
- [x] Stores de market data ya son por símbolo y limpian con `resetSymbol` — no hay leak entre símbolos.
- [ ] Watchlist UI: componente que monte features ligeros (`ticker`+`candles 1m`) por símbolo no enfocado. Pendiente implementación.

---

## 3. Resumen de cambios por archivo

| Archivo | Cambio |
|---|---|
| [futuresSocketClient.js](tv3-main/tv3-main/src/features/futures/infrastructure/futuresSocketClient.js) | Quitar default de `intervals`. Aceptar `{intervals, features}`. |
| [useFuturesAssetRealtime.js](tv3-main/tv3-main/src/features/futures/application/useFuturesAssetRealtime.js) | Dejar de manejar `intervals`; delegar a `useSocketSubscriptionSync`. |
| [useFootprintCandles.js](tv3-main/tv3-main/src/features/futures/application/useFootprintCandles.js) | Recibir `interval` único, registrar feature `footprint`. |
| [useCvdData.js](tv3-main/tv3-main/src/features/futures/application/useCvdData.js) | TF-aware, registrar feature `cvd`. |
| [useLiquidityData.js](tv3-main/tv3-main/src/features/futures/application/useLiquidityData.js) | Renombrar imbalance → `orderbookImbalance`; gating por feature. |
| [useFuturesDashboardState.js](tv3-main/tv3-main/src/features/futures/ui/state/useFuturesDashboardState.js) | Exportar TF activo; dejar de pasar `INTERVALS` a hooks; mover hooks a paneles hijos. |
| nuevo `application/subscriptions/subscriptionPlanStore.js` | Refcount de `(symbol, feature, interval)`. |
| nuevo `application/subscriptions/useFeatureSubscription.js` | Registrar/desregistrar features. |
| nuevo `application/subscriptions/useSocketSubscriptionSync.js` | Diff + emit a socket, debounced. |
| nuevo `domain/timeframes.js` | `export const INTERVALS = [...]`. |
| backend `tv1-main/.../futures.router.js` y `symbolWorker.js` | Aceptar `features`, emitir CVD/footprint con `interval`, gatear emisión. |

---

## 4. Orden de ejecución sugerido

1. Fase 1 (TFs unificados) — desbloquea `1h/4h` ya.
2. Fase 3 backend (CVD por TF) en paralelo con Fase 2 UI (separar imbalances).
3. Fase 4 (suscripciones modulares) — refactor mayor.
4. Fase 5 (lazy mount) — consecuencia natural de Fase 4.
5. Fase 6 (observabilidad).
6. Fase 7 (multi-símbolo) cuando se vaya a sumar más assets.

---

## 5. Criterios de aceptación

- Cambiar a `4h` en la UI hace que **sólo** lleguen eventos `4h` (candles, footprint, cvd) además de los streams microestructurales.
- Cerrar la pestaña heatmap deja de generar snapshots de heatmap en memoria.
- 4 símbolos en watchlist con 1 enfocado: tráfico WS del símbolo enfocado ≫ tráfico de los otros 3 sumados.
- No existen dos métricas llamadas "imbalance" con semánticas distintas en la misma vista.
- Cambiar de TF 10 veces rápidamente produce 1 sólo `SUBSCRIBE_ASSET` efectivo (debounce).
