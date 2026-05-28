# Plan TV3 — UI Risk, Orders & Portfolio

UI/hooks/stores para consumir los nuevos endpoints REST + eventos socket que provee tv1. El cliente API, socket client y `portfolioStore` ya existen. Falta extenderlos con métodos de órdenes, riesgo y portafolio, crear stores adicionales, hooks de aplicación y secciones UI.

## Fases

### Fase 0 — Preparación
- Rama: `feature/tv3-managers-ui`.
- Verificar vars `REACT_APP_API_BASE_URL` y `REACT_APP_SOCKET_URL`.
- Añadir los 3 nuevos eventos a `src/features/futures/infrastructure/futuresSocketEvents.js` (`RISK_DECISION`, `ORDER_LIFECYCLE`, `PORTFOLIO_SNAPSHOT`).

### Fase 1 — Cliente API (paralelizable)
Extender `src/features/futures/infrastructure/futuresApiClient.js` con:
- `submitOrder(payload)` → `POST /api/futures/orders`
- `cancelOrder(orderId)` → `PUT /api/futures/orders/:id/cancel`
- `fetchOrder(orderId)` → `GET /api/futures/orders/:id`
- `fetchOpenOrdersAll()` → `GET /api/futures/orders/open`
- `fetchRiskLimits()` → `GET /api/futures/risk/limits`
- `checkRisk(payload)` → `POST /api/futures/risk/check`
- `fetchPortfolioPositions(params)` → `GET /api/futures/portfolio/positions`
- `fetchPortfolioExposure()` → `GET /api/futures/portfolio/exposure`
- `fetchPortfolioPerformance()` → `GET /api/futures/portfolio/performance`

### Fase 2 — Stores Zustand (paralelizable)
- Crear `src/features/futures/application/stores/ordersStore.js`: `ordersById`, `openOrderIds`, acciones `setOrders`, `upsertOrder`, `applyLifecycle`.
- Crear `src/features/futures/application/stores/riskStore.js`: `limits`, `lastDecision`, `recentDecisions[]`, acciones `setLimits`, `pushDecision`.
- Extender `portfolioStore.js`: añadir `exposure`, `performance`, `lastSnapshotAt` + acciones `setExposure`, `setPerformance`, `applySnapshot`.

### Fase 3 — Hooks (depende 1+2)
- `src/features/futures/application/useOrdersState.js`: fetch inicial + sub `ORDER_LIFECYCLE` → `applyLifecycle`. Expone `{ openOrders, submit, cancel, isSubmitting, lastError }`.
- `src/features/futures/application/usePortfolioState.js`: fetch posiciones + exposure + sub `PORTFOLIO_SNAPSHOT`.
- `src/features/futures/application/useRiskState.js`: fetch limits + sub `RISK_DECISION`.

### Fase 4 — UI (depende Fase 3)
- `src/features/futures/ui/components/PositionsTable.jsx` — tabla MUI de posiciones (live PnL).
- `src/features/futures/ui/components/OrdersHistoryTable.jsx` — tabla con acción cancelar.
- `src/features/futures/ui/components/PortfolioSummaryCard.jsx` — balance/PnL/exposición/drawdown.
- `src/features/futures/ui/components/RiskBanner.jsx` — Snackbar/Alert para `RISK_DECISION`.
- Modificar `ExecutionSidebarSection.jsx` (o `TradeTicket` interno) para llamar `submitOrder` y mostrar `reason` en error 4xx.
- Modificar `FuturesAssetDashboard.jsx` y/o `FuturesHeaderSection.jsx`/`MarketFlowBottomSection.jsx` para montar nuevas vistas.

### Fase 5 — Tests (2-3 d)
- Tests unitarios stores (`applyLifecycle`, `applySnapshot`, cap de decisiones).
- Tests de hooks con mocks de API + socket.
- Tests de componentes clave (`PositionsTable`, `OrdersHistoryTable`).

## Archivos

**Crear**
- `src/features/futures/application/stores/ordersStore.js`
- `src/features/futures/application/stores/riskStore.js`
- `src/features/futures/application/useOrdersState.js`
- `src/features/futures/application/usePortfolioState.js`
- `src/features/futures/application/useRiskState.js`
- `src/features/futures/ui/components/PositionsTable.jsx`
- `src/features/futures/ui/components/OrdersHistoryTable.jsx`
- `src/features/futures/ui/components/PortfolioSummaryCard.jsx`
- `src/features/futures/ui/components/RiskBanner.jsx`

**Modificar**
- `src/features/futures/infrastructure/futuresApiClient.js` — nuevos métodos.
- `src/features/futures/infrastructure/futuresSocketEvents.js` — añadir 3 eventos.
- `src/features/futures/application/stores/portfolioStore.js` — extender state.
- `src/features/futures/ui/sections/ExecutionSidebarSection.jsx` — usar `submitOrder`.
- `src/features/futures/ui/pages/FuturesAssetDashboard.jsx` — montar nuevas vistas.

## Verificación
- `npm test` verde, cobertura ≥80% módulos nuevos.
- `npm start` + tv1 corriendo:
  - Crear orden desde execution sidebar → aparece en historial y posiciones.
  - Orden fuera de límite → banner de riesgo + error inline con `reason`.
  - Cancel desde tabla → status `CANCELED` en vivo.
  - DevTools Network confirma `/api/futures/orders|portfolio|risk`.
  - DevTools WS confirma eventos `ORDER_LIFECYCLE`, `PORTFOLIO_SNAPSHOT`, `RISK_DECISION`.

## Decisiones
- Stack inalterado: React 19 + Zustand + Socket.io-client + MUI.
- Patrón hooks: fetch on mount + sub socket con cleanup (igual que `useFuturesAssetContext`).
- Stores globales Zustand para compartir entre secciones sin prop drilling.
- `RISK_DECISION` se muestra como **toast efímero** + entrada en historial.
- Sin Redux. Sin nuevo auth (reutiliza token de localStorage).

**Fuera de alcance**: gráficos PnL histórico, configuración persistente de reglas desde UI, OCO desde chart.
