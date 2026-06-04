/**
 * marketDataStore
 *
 * Per-symbol ticker, mark-price, funding, server-side snapshot (context),
 * and candlestick arrays.  High-frequency ticker/markPrice events update only
 * this store; OrderBook and OrderFlow panels are completely unaffected.
 */
import { create } from 'zustand'

export const EMPTY_ARRAY = Object.freeze([])
export const EMPTY_CANDLES = Object.freeze({})

function toMs(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n < 1_000_000_000_000 ? n * 1000 : n
}

function toFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function extractEventTime(raw) {
  if (!raw) return null
  const metaTime = toMs(raw?._meta?.exchangeEventTime)
  if (metaTime != null) return metaTime
  return toMs(raw.eventTime ?? raw.E ?? raw.timestamp ?? raw.ts)
}

function normalizeInterval(raw, defaultInterval = null) {
  return raw?.interval ?? raw?.i ?? defaultInterval ?? null
}

function normalizeCandle(raw, defaultInterval = null) {
  if (!raw) return null

  const openTime = toMs(raw.openTime ?? raw.t ?? raw.open_time)
  if (openTime == null) return null

  const open = toFiniteNumber(raw.open ?? raw.o)
  const high = toFiniteNumber(raw.high ?? raw.h)
  const low = toFiniteNumber(raw.low ?? raw.l)
  const close = toFiniteNumber(raw.close ?? raw.c)
  const volume = toFiniteNumber(raw.volume ?? raw.v)

  if (open == null || high == null || low == null || close == null || volume == null) return null
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) return null

  return {
    ...raw,
    interval: normalizeInterval(raw, defaultInterval),
    eventTime: extractEventTime(raw),
    openTime,
    closeTime: toMs(raw.closeTime ?? raw.T ?? raw.close_time) ?? raw.closeTime ?? raw.T ?? null,
    open,
    high,
    low,
    close,
    volume,
  }
}

function normalizeCandleList(candles, interval) {
  if (!Array.isArray(candles)) return EMPTY_ARRAY
  const normalized = candles
    .map((c) => normalizeCandle(c, interval))
    .filter(Boolean)
    .sort((a, b) => a.openTime - b.openTime)
  return normalized
}

export const useMarketDataStore = create((set, get) => ({
  /** { [symbol]: object | null } */
  tickerBySymbol: {},

  /** { [symbol]: object | null } */
  markPriceBySymbol: {},

  /** { [symbol]: object | null }  (normalised server snapshot) */
  serverContextBySymbol: {},

  /** { [symbol]: { [interval]: CandleObject[] } } */
  candlesBySymbol: {},

  /** { [symbol]: { [interval]: IndicatorPayload | null } } */
  indicatorsBySymbol: {},

  // ── actions ───────────────────────────────────────────────────────────────

  resetSymbol(symbol) {
    if (!symbol) return
    set((s) => ({
      tickerBySymbol: { ...s.tickerBySymbol, [symbol]: null },
      markPriceBySymbol: { ...s.markPriceBySymbol, [symbol]: null },
      serverContextBySymbol: { ...s.serverContextBySymbol, [symbol]: null },
      candlesBySymbol: { ...s.candlesBySymbol, [symbol]: {} },
      indicatorsBySymbol: { ...s.indicatorsBySymbol, [symbol]: {} },
    }))
  },

  /** Phase 5.5 — fully evict symbol slots (delete vs zeroing) */
  cleanupSymbol(symbol) {
    if (!symbol) return
    set((s) => {
      const t = { ...s.tickerBySymbol };        delete t[symbol]
      const m = { ...s.markPriceBySymbol };     delete m[symbol]
      const sc = { ...s.serverContextBySymbol }; delete sc[symbol]
      const c = { ...s.candlesBySymbol };       delete c[symbol]
      const i = { ...s.indicatorsBySymbol };    delete i[symbol]
      return { tickerBySymbol: t, markPriceBySymbol: m, serverContextBySymbol: sc, candlesBySymbol: c, indicatorsBySymbol: i }
    })
  },

  setTicker(symbol, ticker) {
    if (!symbol) return
    set((s) => ({
      tickerBySymbol: { ...s.tickerBySymbol, [symbol]: ticker },
    }))
  },

  setMarkPrice(symbol, markPrice) {
    if (!symbol) return
    set((s) => ({
      markPriceBySymbol: { ...s.markPriceBySymbol, [symbol]: markPrice },
    }))
  },

  setServerContext(symbol, context) {
    if (!symbol) return
    set((s) => ({
      serverContextBySymbol: { ...s.serverContextBySymbol, [symbol]: context },
    }))
  },

  clearServerContext(symbol) {
    if (!symbol) return
    set((s) => {
      if (!(symbol in s.serverContextBySymbol) || s.serverContextBySymbol[symbol] == null) return s
      return {
        serverContextBySymbol: { ...s.serverContextBySymbol, [symbol]: null },
      }
    })
  },

  setCandles(symbol, interval, candles) {
    if (!symbol || !interval) return
    const normalized = normalizeCandleList(candles, interval)
    set((s) => {
      const prev = s.candlesBySymbol[symbol] ?? {}
      if (prev[interval] === normalized) return s
      return {
        candlesBySymbol: {
          ...s.candlesBySymbol,
          [symbol]: { ...prev, [interval]: normalized },
        },
      }
    })
  },

  upsertCandle(symbol, interval, candle, maxLength = 500) {
    if (!symbol || !interval || !candle) return
    const normalized = normalizeCandle(candle, interval)
    if (!normalized) return
    set((s) => {
      const symbolCandles = s.candlesBySymbol[symbol] ?? {}
      const prevList = symbolCandles[interval] ?? EMPTY_ARRAY
      const idx = prevList.findIndex((c) => c.openTime === normalized.openTime)
      if (idx >= 0 && prevList[idx] === normalized) return s

      let updated
      if (idx >= 0) {
        const prevCandle = prevList[idx]
        // Keep closed candles immutable when a late in-progress update arrives.
        if (prevCandle?.isFinal && !normalized?.isFinal) return s
        updated = [...prevList]
        updated[idx] = normalized
      } else {
        updated = [...prevList, normalized].slice(-maxLength)
      }

      // Keep chronological order even if late/out-of-order WS candle updates arrive.
      updated.sort((a, b) => a.openTime - b.openTime)

      return {
        candlesBySymbol: {
          ...s.candlesBySymbol,
          [symbol]: { ...symbolCandles, [interval]: updated },
        },
      }
    })
  },

  setIndicators(symbol, interval, indicators) {
    if (!symbol || !interval) return
    set((s) => {
      const prev = s.indicatorsBySymbol[symbol] ?? {}
      return {
        indicatorsBySymbol: {
          ...s.indicatorsBySymbol,
          [symbol]: { ...prev, [interval]: indicators },
        },
      }
    })
  },
}))

// ── selectors ────────────────────────────────────────────────────────────────

export const selectTickerBySymbol = (symbol) => (s) => s.tickerBySymbol[symbol] ?? null
export const selectMarkPriceBySymbol = (symbol) => (s) => s.markPriceBySymbol[symbol] ?? null
export const selectServerContextBySymbol = (symbol) => (s) => s.serverContextBySymbol[symbol] ?? null
export const selectCandlesBySymbolInterval = (symbol, interval) => (s) =>
  s.candlesBySymbol[symbol]?.[interval] ?? EMPTY_ARRAY
export const selectAllCandlesBySymbol = (symbol) => (s) => s.candlesBySymbol[symbol] ?? EMPTY_CANDLES
export const selectIndicatorsBySymbolInterval = (symbol, interval) => (s) =>
  s.indicatorsBySymbol[symbol]?.[interval] ?? null
