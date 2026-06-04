import { create } from 'zustand'

const EMPTY_LIST = Object.freeze([])

function normalizePosition(position) {
  const currentPrice = Number(position.currentPrice ?? position.entryPrice ?? 0)
  return {
    ...position,
    entryPrice: Number(position.entryPrice ?? 0),
    quantity: position.quantity == null ? null : Number(position.quantity),
    currentPrice,
    exitPrice:
      position.exitPrice != null ? Number(position.exitPrice) : position.status === 'CLOSED' ? currentPrice : null,
    unrealizedPnl: Number(position.unrealizedPnl ?? 0),
    realizedPnl: position.realizedPnl == null ? null : Number(position.realizedPnl),
  }
}

function upsertById(list, item) {
  const idx = list.findIndex((p) => p.id === item.id)
  if (idx === -1) return [item, ...list]
  const copy = list.slice()
  copy[idx] = item
  return copy
}

export const usePaperTradeStore = create((set) => ({
  openBySymbol: {},
  closedBySymbol: {},

  resetSymbol(symbol) {
    if (!symbol) return
    set((s) => ({
      openBySymbol: { ...s.openBySymbol, [symbol]: [] },
      closedBySymbol: { ...s.closedBySymbol, [symbol]: [] },
    }))
  },

  /** Phase 5.5 — fully evict symbol slots */
  cleanupSymbol(symbol) {
    if (!symbol) return
    set((s) => {
      const o = { ...s.openBySymbol }
      delete o[symbol]
      const c = { ...s.closedBySymbol }
      delete c[symbol]
      return { openBySymbol: o, closedBySymbol: c }
    })
  },

  onOpened(symbol, position) {
    if (!symbol || !position) return
    const next = normalizePosition(position)
    set((s) => {
      const prevOpen = s.openBySymbol[symbol] ?? EMPTY_LIST
      return {
        openBySymbol: {
          ...s.openBySymbol,
          [symbol]: upsertById(prevOpen, next),
        },
      }
    })
  },

  onUpdated(symbol, position) {
    if (!symbol || !position) return
    const next = normalizePosition(position)
    set((s) => {
      const prevOpen = s.openBySymbol[symbol] ?? EMPTY_LIST
      return {
        openBySymbol: {
          ...s.openBySymbol,
          [symbol]: upsertById(prevOpen, next),
        },
      }
    })
  },

  onClosed(symbol, position) {
    if (!symbol || !position) return
    const next = normalizePosition(position)
    set((s) => {
      const prevOpen = s.openBySymbol[symbol] ?? EMPTY_LIST
      const prevClosed = s.closedBySymbol[symbol] ?? EMPTY_LIST
      const nextOpen = prevOpen.filter((p) => p.id !== next.id)
      const nextClosed = [next, ...prevClosed.filter((p) => p.id !== next.id)].slice(0, 200)

      return {
        openBySymbol: { ...s.openBySymbol, [symbol]: nextOpen },
        closedBySymbol: { ...s.closedBySymbol, [symbol]: nextClosed },
      }
    })
  },

  hydrateSymbol(symbol, positions) {
    if (!symbol || !Array.isArray(positions)) return

    const normalized = positions.map(normalizePosition)
    const open = normalized.filter((p) => p.status === 'OPEN')
    const closed = normalized.filter((p) => p.status === 'CLOSED').slice(0, 200)

    set((s) => ({
      openBySymbol: { ...s.openBySymbol, [symbol]: open },
      closedBySymbol: { ...s.closedBySymbol, [symbol]: closed },
    }))
  },
}))

export const selectOpenPaperPositionsBySymbol = (symbol) => (s) => s.openBySymbol[symbol] ?? EMPTY_LIST

export const selectClosedPaperPositionsBySymbol = (symbol) => (s) => s.closedBySymbol[symbol] ?? EMPTY_LIST
