# Plan de mejoras Frontend — tv3

## Objetivo

Convertir `tv3` en una interfaz cuantitativa confiable para lectura de order flow y microestructura de mercado.

La UI no debe limitarse a renderizar datos. Debe:

- Validar y sanitizar datos antes de mostrarlos.
- Detectar inconsistencias visuales.
- Mantener escalas coherentes.
- Evitar métricas engañosas.
- Renderizar gráficos robustos frente a datos parciales.
- Mostrar estados claros de sincronización y calidad.

Problemas observados:

- `midPrice` visual incorrecto.
- `spread` visual absurdo.
- `imbalance` mostrando `NaN%`.
- Heatmap comprimido por rango excesivo.
- Walls irrelevantes.
- Footprint pobre o vacío.
- DOM contaminado con niveles muy alejados.
- Falta de validación visual del order book.
- Charts D3 demasiado dependientes del formato entrante.

---

## 1. Corregir `orderbook.model.js`

### Archivo

```txt
src/features/futures/domain/orderbook.model.js
```

### Problema

`processOrderBook()` procesa niveles sin ordenar ni validar.

Eso contamina:

- DOM.
- Depth chart.
- Imbalance.
- Heatmap.
- Walls.
- Footprint contextual.

### Mejoras requeridas

1. Parsear `price` y `quantity`.
2. Filtrar inválidos.
3. Filtrar `quantity <= 0`.
4. Ordenar bids descendente.
5. Ordenar asks ascendente.
6. Calcular running totals después de ordenar.
7. Exponer:
   - bestBid
   - bestAsk
   - spread
   - midPrice
   - isValidTopOfBook

### Estructura esperada

```js
{
  bids,
  asks,
  bestBid,
  bestAsk,
  spread,
  spreadPct,
  midPrice,
  isValidTopOfBook,
}
```

### Resultado esperado

El frontend nunca debe depender de que Binance o el backend entreguen arrays ordenados.

---

## 2. Crear capa de sanitización de market data

### Nuevo archivo sugerido

```txt
src/features/futures/utils/marketDataGuards.js
```

### Objetivo

Blindar la UI frente a:

- `undefined`
- `null`
- `NaN`
- arrays vacíos
- precios negativos
- cantidades inválidas
- spreads negativos

### Helpers sugeridos

```js
isFiniteNumber(value)
safeNumber(value, fallback)
sanitizeOrderBook(orderBook)
sanitizeTrades(trades)
sanitizeCandles(candles)
sanitizeFootprint(footprint)
```

### Reglas globales

Los componentes gráficos nunca deben:

- asumir que `bids[0]` existe
- asumir que `asks[0]` existe
- asumir que `spread` es válido
- renderizar si no hay datos válidos
- renderizar `NaN`

---

## 3. Mejorar `DepthChartD3.jsx`

### Archivo

```txt
src/features/futures/ui/components/DepthChartD3.jsx
```

### Problemas observados

- Usa `bids[0]` y `asks[0]` sin validar.
- Puede renderizar `midPrice` falso.
- Puede renderizar `spread` absurdo.
- Usa todo el rango de precios disponible.

### Mejoras requeridas

1. Ordenar bids y asks internamente.
2. Filtrar niveles inválidos.
3. Calcular `bestBid` y `bestAsk` correctamente.
4. Validar que `bestAsk > bestBid`.
5. No renderizar si el top of book es inválido.
6. Limitar el rango visual:
   - top 20
   - top 50
   - ±0.25%
   - ±0.5%
   - ±1%
7. Mostrar spread real.
8. Mostrar spread porcentual.
9. Agregar modo:
   - tactical
   - macro

### Tactical mode

```txt
Muy cerca del mid.
Optimizado para scalping.
```

### Macro mode

```txt
Muestra liquidez más lejana.
Útil para estructura.
```

### Mejoras UX

- Tooltip por nivel.
- Hover highlight.
- Mostrar cumulative liquidity.
- Mostrar imbalance visual.
- Mostrar mark price.
- Mostrar best bid/ask.

---

## 4. Mejorar `OrderBookPanel.jsx`

### Archivo

```txt
src/features/futures/ui/components/OrderBookPanel.jsx
```

### Problemas

El DOM muestra niveles irrelevantes muy alejados del mercado.

### Mejoras requeridas

1. Mostrar solo ventana táctica configurable.
2. Agregar selector:
   - top 10
   - top 20
   - top 50
   - ±0.25%
   - ±0.5%
3. Separar:
   - DOM táctico
   - macro liquidity
4. Mostrar:
   - price
   - quantity
   - cumulative total
   - notional
5. Highlight:
   - best bid
   - best ask
   - walls
6. Scroll estable.
7. Virtualización si hay muchos niveles.
8. Animar cambios de qty.
9. Colorear:
   - liquidity added
   - liquidity removed

### Mejoras visuales

- Flash verde cuando aumenta qty.
- Flash rojo cuando desaparece liquidez.
- Heat overlay por tamaño.
- Mostrar spread en centro.

---

## 5. Estandarizar imbalance visual

### Archivos

```txt
src/features/futures/domain/orderbook.model.js
src/features/futures/ui/components/OrderBookImbalance.jsx
```

### Objetivo

Usar imbalance estándar `[-1, 1]`.

### Reglas

```txt
-1 = fuerte presión vendedora
 0 = neutral
+1 = fuerte presión compradora
```

### Mejoras visuales

- Gauge horizontal.
- Color dinámico.
- Thresholds:
  - neutral
  - bullish
  - strongly bullish
  - bearish
  - strongly bearish
- Mostrar:
  - bidVolumeTopN
  - askVolumeTopN
  - delta porcentual

### Reglas sugeridas

```txt
> 0.30  -> bullish
> 0.60  -> strong bullish
< -0.30 -> bearish
< -0.60 -> strong bearish
```

### Protección requerida

Nunca mostrar:

```txt
NaN%
Infinity
undefined
```

---

## 6. Mejorar `LiquidityHeatmapD3.jsx`

### Archivo

```txt
src/features/futures/ui/components/LiquidityHeatmapD3.jsx
```

### Problema

El heatmap se comprime por usar todo el rango de precios del book.

### Mejoras requeridas

1. Ventana dinámica alrededor del mid.
2. Modo táctico y macro.
3. Scroll horizontal temporal.
4. Persistencia visual de liquidez.
5. Fade temporal.
6. Mostrar:
   - liquidity added
   - liquidity removed
7. Diferenciar:
   - liquidez resting
   - liquidez ejecutada
8. Render incremental.
9. Optimizar performance.

### Escala recomendada

```txt
Tactical:
mid ± 0.25%

Macro:
mid ± 1%
```

### Color intensity

Basado en:

```txt
notional
relative liquidity
lifetime
```

---

## 7. Crear visualización de liquidity shifts

### Nuevo componente sugerido

```txt
src/features/futures/ui/components/LiquidityShiftTimelineD3.jsx
```

### Objetivo

Visualizar:

- liquidez agregada
- liquidez removida
- shifts de imbalance
- agresión cerca del precio

### Evento esperado backend

```json
{
  "type": "LIQUIDITY_REMOVED",
  "side": "ASK",
  "delta": "-25.2",
  "severity": "HIGH"
}
```

### Visualización sugerida

Timeline con:

- barras
- color intensity
- severity
- fade temporal

---

## 8. Mejorar `TapeReader`

### Nuevo componente sugerido

```txt
src/features/futures/ui/components/TapeReader.jsx
```

### Fuente

`aggTrade`.

### Mostrar

- tiempo
- precio
- qty
- notional
- agresor comprador/vendedor
- trades grandes

### Clasificación

```txt
buyerIsMaker = true  -> sell aggressive
buyerIsMaker = false -> buy aggressive
```

### Features sugeridas

- filtro min notional
- highlights de block trades
- scroll realtime
- freeze on hover
- sonido opcional

---

## 9. Crear `CvdChartD3.jsx`

### Nuevo componente sugerido

```txt
src/features/futures/ui/components/CvdChartD3.jsx
```

### Objetivo

Mostrar:

- CVD acumulado
- delta por vela
- divergencias precio/CVD

### Mejoras visuales

- overlay con precio
- detectar divergencias
- colorear momentum
- mostrar aceleración de delta

### Datos requeridos

```json
{
  "time": 1710000000000,
  "delta": "2.3",
  "cvd": "123.7"
}
```

---

## 10. Mejorar footprint candles

### Nuevo componente sugerido

```txt
src/features/futures/ui/components/FootprintChartD3.jsx
```

### Problema

El footprint actual parece pobre o mal bucketizado.

### Footprint correcto

Debe agrupar trades por:

```txt
interval
candleStartTime
priceBucket usando tickSize
buyVolume
sellVolume
delta
```

### Visualización recomendada

Por precio:

```txt
buy x sell
delta
volume
imbalance
```

### Features sugeridas

- highlight stacked imbalance
- unfinished auction
- absorption visual
- bid/ask imbalance cells
- delta coloring
- zoom vertical

---

## 11. Crear MarketDataStatusBar

### Nuevo componente sugerido

```txt
src/features/futures/ui/components/MarketDataStatusBar.jsx
```

### Objetivo

Mostrar salud del market data engine.

### Datos sugeridos

```json
{
  "bookSynced": true,
  "lastUpdateAgeMs": 120,
  "resyncCount": 1,
  "gapCount": 0,
  "wsReconnectCount": 2
}
```

### Indicadores visuales

- synced
- reconnecting
- stale data
- resyncing
- degraded

### UX importante

El trader debe saber cuándo confiar en los datos.

---

## 12. Mejorar arquitectura realtime frontend

### Archivos

```txt
src/features/futures/application/useFuturesAssetRealtime.js
src/features/futures/infrastructure/futuresSocketClient.js
```

### Problemas

El frontend mezcla tipos de eventos y no diferencia snapshot vs delta vs local book.

### Mejoras requeridas

Separar estados:

```js
{
  topOfBook,
  partialBook,
  localBook,
  trades,
  cvd,
  footprint,
  liquidity,
  spoofingCandidates,
}
```

### Eventos sugeridos

```txt
futures:book:top
futures:book:partial
futures:book:local
futures:trade:agg
futures:orderflow:cvd
futures:orderflow:footprint
futures:liquidity:shift
futures:spoofing:candidate
```

### Mejoras importantes

- Buffering.
- Throttling render.
- RequestAnimationFrame.
- Batch updates.
- Memoización.

---

## 13. Performance y rendering

### Problemas potenciales

Los charts D3 pueden degradarse rápidamente con:

- demasiados trades
- demasiados depth levels
- rerenders innecesarios
- arrays recreados constantemente

### Mejoras requeridas

1. Virtualizar tablas.
2. Limitar profundidad visual.
3. Throttle updates.
4. Batch renders.
5. Memoizar cálculos.
6. Separar cálculos pesados.
7. Render incremental.
8. Evitar `setState` por trade.
9. Usar refs para buffers.

### Objetivo

Mantener:

```txt
60 FPS estable
```

incluso con:

```txt
BTCUSDT realtime
100ms depth
aggTrades constantes
```

---

## 14. Mejorar UX cuantitativa

### Mejoras sugeridas

#### Layout

Separar claramente:

```txt
Market Context
Order Flow
Execution
Risk
```

#### Colores

- verde = buy aggression
- rojo = sell aggression
- naranja = warning
- amarillo = liquidity shift
- violeta = spoofing candidate

#### Tooltips

Todos los gráficos deben explicar:

- qué representa
- cómo se calcula
- interpretación táctica

#### Keyboard shortcuts

Agregar:

```txt
B -> buy
S -> sell
L -> limit
M -> market
```

#### Responsive

Separar:

```txt
Desktop trading layout
Tablet monitoring layout
Mobile simplified layout
```

---

## 15. Mejorar testing frontend

### Tests sugeridos

#### Domain

```txt
orderbook.model.test.js
marketDataGuards.test.js
```

#### Components

```txt
DepthChartD3.test.jsx
OrderBookPanel.test.jsx
OrderBookImbalance.test.jsx
LiquidityHeatmapD3.test.jsx
```

### Casos mínimos

- bids desordenados
- asks desordenados
- qty inválida
- spread negativo
- imbalance sin NaN
- heatmap con arrays vacíos
- chart sin datos
- book inválido
- footprint bucketizado correctamente

---

## 16. Prioridad de implementación

```txt
P0 - Crítico
1. Corregir orderbook.model.js.
2. Blindar charts contra NaN.
3. Corregir DepthChartD3.
4. Estandarizar imbalance.

P1 - Muy importante
5. Mejorar OrderBookPanel.
6. Mejorar heatmap.
7. Separar realtime states.
8. Crear MarketDataStatusBar.

P2 - Order flow
9. TapeReader.
10. CvdChartD3.
11. FootprintChartD3.
12. LiquidityShiftTimelineD3.

P3 - Performance
13. Batch rendering.
14. Virtualización.
15. RequestAnimationFrame.
16. Memoización.

P4 - UX cuantitativa
17. Tooltips.
18. Keyboard shortcuts.
19. Layout avanzado.
20. Responsive cuantitativo.
```

---

## Definition of Done

El frontend se considera correctamente mejorado cuando:

- Nunca muestra `NaN`, `Infinity` o métricas inválidas.
- `bestBid`, `bestAsk`, `spread` y `midPrice` son coherentes.
- Depth chart muestra información táctica útil.
- Heatmap usa una ventana lógica alrededor del precio.
- Walls lejanas no contaminan la UI táctica.
- Imbalance usa un único estándar `[-1, 1]`.
- Existe separación clara entre partial depth, local book y trades.
- Footprint se construye correctamente por `tickSize`.
- CVD representa correctamente buy/sell aggression.
- Hay estado visual de sincronización y salud de market data.
- Los gráficos mantienen performance estable en realtime.
- Existe cobertura mínima de tests para casos críticos.
