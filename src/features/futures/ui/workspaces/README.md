# Futures Dashboard Workspaces

Este directorio agrupa los contenedores de alto nivel del dashboard de futuros.

El objetivo no es solo limpiar código: el dashboard debe funcionar como una terminal de decisión rápida para scalping/orderflow.

## Principio de producto

La información crítica para decidir en segundos debe estar visible al mismo tiempo.

El usuario no debería cambiar de tab para responder:

- ¿Dónde está el precio respecto a la liquidez cercana?
- ¿Hay imbalance comprador o vendedor?
- ¿El tape confirma agresión?
- ¿Hay walls o spoofing cerca?
- ¿Cuál es el riesgo antes de operar?
- ¿Los datos realtime están sanos?

## Layout objetivo

```txt
┌──────────────────────────────────────────────────────┐
│ DashboardHeader                                      │
├───────────────┬──────────────────────┬───────────────┤
│ MarketSidebar │ ChartWorkspace       │ Execution     │
│               │                      │ Sidebar       │
├───────────────┴──────────────────────┴───────────────┤
│ MarketFlowStrip                                      │
└──────────────────────────────────────────────────────┘
```

## Workspaces

- `DashboardHeader`: símbolo, precios, funding, status, modo paper/live.
- `MarketSidebar`: order book, spread, imbalance, liquidity walls.
- `ChartWorkspace`: candles como vista principal con overlays relevantes.
- `ExecutionSidebar`: ticket de orden, riesgo, validación, reglas esenciales.
- `MarketFlowStrip`: tape, CVD, spoofing, liquidity shifts y posiciones compactas.

## Regla UX

Los tabs quedan para análisis secundario. No deben ocultar información crítica para la decisión inmediata.
