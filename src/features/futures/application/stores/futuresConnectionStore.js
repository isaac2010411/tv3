/**
 * futuresConnectionStore
 *
 * Tracks WebSocket connection status, socket errors, and per-symbol
 * book-health metrics. Isolated so that health polling or reconnect
 * events never force unrelated panels (OrderBook, CVD, …) to re-render.
 */
import { create } from 'zustand'

export const EMPTY_HEALTH = Object.freeze({
  bookSynced: false,
  lastUpdateAgeMs: null,
  resyncCount: 0,
  gapCount: 0,
  wsReconnectCount: 0,
})

export const useFuturesConnectionStore = create((set, get) => ({
  /** 'disconnected' | 'connecting' | 'connected' */
  connectionStatus: 'disconnected',

  /** { [symbol]: { bookSynced, lastUpdateAgeMs, resyncCount, gapCount, wsReconnectCount } } */
  healthBySymbol: {},

  /** { [symbol]: string | null } */
  socketErrorBySymbol: {},

  // ── actions ───────────────────────────────────────────────────────────────

  setConnectionStatus(connectionStatus) {
    set((s) => (s.connectionStatus === connectionStatus ? s : { connectionStatus }))
  },

  resetSymbol(symbol) {
    if (!symbol) return
    set((s) => ({
      healthBySymbol: { ...s.healthBySymbol, [symbol]: { ...EMPTY_HEALTH } },
      socketErrorBySymbol: { ...s.socketErrorBySymbol, [symbol]: null },
    }))
  },

  /** Phase 5.5 — fully evict symbol slots */
  cleanupSymbol(symbol) {
    if (!symbol) return
    set((s) => {
      const h = { ...s.healthBySymbol };       delete h[symbol]
      const e = { ...s.socketErrorBySymbol };  delete e[symbol]
      return { healthBySymbol: h, socketErrorBySymbol: e }
    })
  },

  setHealth(symbol, patch) {
    if (!symbol) return
    set((s) => {
      const prev = s.healthBySymbol[symbol] ?? EMPTY_HEALTH
      const next = { ...prev, ...patch }
      if (
        prev.bookSynced === next.bookSynced &&
        prev.lastUpdateAgeMs === next.lastUpdateAgeMs &&
        prev.resyncCount === next.resyncCount &&
        prev.gapCount === next.gapCount &&
        prev.wsReconnectCount === next.wsReconnectCount
      ) {
        return s
      }
      return {
        healthBySymbol: {
          ...s.healthBySymbol,
          [symbol]: next,
        },
      }
    })
  },

  incrementWsReconnect(symbol) {
    if (!symbol) return
    set((s) => {
      const prev = s.healthBySymbol[symbol] ?? EMPTY_HEALTH
      return {
        healthBySymbol: {
          ...s.healthBySymbol,
          [symbol]: { ...prev, wsReconnectCount: prev.wsReconnectCount + 1 },
        },
      }
    })
  },

  setSocketError(symbol, message) {
    if (!symbol) return
    set((s) => {
      const nextMessage = message ?? null
      if (s.socketErrorBySymbol[symbol] === nextMessage) return s
      return {
        socketErrorBySymbol: {
          ...s.socketErrorBySymbol,
          [symbol]: nextMessage,
        },
      }
    })
  },
}))

// ── selectors ───────────────────────────────────────────────────────────────

export const selectConnectionStatus = (s) => s.connectionStatus
export const selectHealthBySymbol = (symbol) => (s) => s.healthBySymbol[symbol] ?? EMPTY_HEALTH
export const selectSocketErrorBySymbol = (symbol) => (s) => s.socketErrorBySymbol[symbol] ?? null
