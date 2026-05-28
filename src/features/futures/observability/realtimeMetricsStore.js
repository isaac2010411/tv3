import { create } from 'zustand'

const MAX_SAMPLES = 120
const ONE_SECOND_MS = 1000
const MAX_TRACKED_SYMBOLS = 20

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function wallNowMs() {
  return Date.now()
}

function normalizeWallTs(value) {
  if (value == null) return null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    // Support ISO timestamps without relying on implicit Number conversion.
    if (!/^[-+]?\d+(\.\d+)?$/.test(trimmed)) {
      const parsed = Date.parse(trimmed)
      return Number.isFinite(parsed) ? parsed : null
    }
  }

  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null

  // Normalize common epoch units (s/ms/us/ns) to milliseconds.
  if (n > 1_000_000_000_000_000_000) return Math.floor(n / 1_000_000)
  if (n > 1_000_000_000_000_000) return Math.floor(n / 1000)
  if (n < 1_000_000_000_000) return Math.floor(n * 1000)
  return Math.floor(n)
}

function sanitizeLatency(value) {
  if (!Number.isFinite(value)) return null

  // Ignore clearly invalid values caused by clock skew/unit mismatches.
  if (value < -10_000 || value > 10 * 60_000) return null
  return value
}

function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)))
  return sorted[idx]
}

function computeLatency(meta, frontendReceivedAtWall) {
  const backendEmittedAt = normalizeWallTs(meta?.backendEmittedAt)
  const exchangeEventTime = normalizeWallTs(meta?.exchangeEventTime)
  const backendReceivedAt = normalizeWallTs(meta?.backendReceivedAt)
  const backendProcessedAt = normalizeWallTs(meta?.backendProcessedAt)
  const exchangeToBackendEmitMs = sanitizeLatency(Number(meta?.exchangeToBackendEmitMs))
  const exchangeToBackendProcessMs = sanitizeLatency(Number(meta?.exchangeToBackendProcessMs))
  const exchangeToBackendReceiveMs = sanitizeLatency(Number(meta?.exchangeToBackendReceiveMs))

  const backendAuthoritativeMs =
    exchangeToBackendEmitMs ?? exchangeToBackendProcessMs ?? exchangeToBackendReceiveMs ?? null

  const transportToFrontendMs =
    backendEmittedAt != null ? sanitizeLatency(frontendReceivedAtWall - backendEmittedAt) : null

  const exchangeToFrontendMs =
    exchangeEventTime != null ? sanitizeLatency(frontendReceivedAtWall - exchangeEventTime) : null

  const backendProcessingMs =
    meta?.backendProcessingMs != null
      ? Number(meta.backendProcessingMs)
      : backendReceivedAt != null && backendProcessedAt != null
        ? backendProcessedAt - backendReceivedAt
        : null

  return {
    backendAuthoritativeMs: Number.isFinite(backendAuthoritativeMs) ? backendAuthoritativeMs : null,
    backendToFrontendMs: Number.isFinite(backendAuthoritativeMs)
      ? backendAuthoritativeMs
      : Number.isFinite(transportToFrontendMs)
        ? transportToFrontendMs
        : null,
    transportToFrontendMs: Number.isFinite(transportToFrontendMs) ? transportToFrontendMs : null,
    exchangeToFrontendMs: Number.isFinite(exchangeToFrontendMs) ? exchangeToFrontendMs : null,
    backendProcessingMs: Number.isFinite(backendProcessingMs) ? backendProcessingMs : null,
  }
}

function buildEmptyStream() {
  return {
    lastReceivedAt: null,
    lastReceivedAtWall: null,
    eventsPerSecond: 0,
    _windowStart: nowMs(),
    _windowCount: 0,
    samples: [],
    backendAuthoritativeMs: null,
    backendToFrontendMs: null,
    transportToFrontendMs: null,
    exchangeToFrontendMs: null,
    backendProcessingMs: null,
    p95BackendToFrontendMs: null,
  }
}

function buildEmptySymbolMetrics() {
  return {
    streams: {},
    render: {},
  }
}

/**
 * Returns the symbol key with the oldest last-received timestamp so it can be
 * evicted when MAX_TRACKED_SYMBOLS is exceeded.
 */
function findOldestSymbol(bySymbol, excludeSymbol) {
  let oldest = null
  let oldestTime = Infinity
  for (const [sym, metrics] of Object.entries(bySymbol)) {
    if (sym === excludeSymbol) continue
    const latestStream = Object.values(metrics.streams ?? {}).reduce(
      (max, s) => Math.max(max, s.lastReceivedAt ?? 0),
      0,
    )
    if (latestStream < oldestTime) {
      oldestTime = latestStream
      oldest = sym
    }
  }
  return oldest
}

export const useRealtimeMetricsStore = create((set) => ({
  bySymbol: {},

  recordEvent: (symbol, stream, payloadOrMeta, eventCount = 1, options = {}) => {
    if (!symbol || !stream) return

    const incrementBy =
      Number.isFinite(Number(eventCount)) && Number(eventCount) > 0 ? Math.floor(Number(eventCount)) : 1

    const receivedAt = Number.isFinite(options?.clientReceivedAt)
      ? Number(options.clientReceivedAt)
      : nowMs()
    const receivedAtWall = Number.isFinite(options?.clientReceivedAtWall)
      ? Number(options.clientReceivedAtWall)
      : wallNowMs()
    const meta = payloadOrMeta?._meta ?? payloadOrMeta ?? null
    const latency = computeLatency(meta, receivedAtWall)

    set((state) => {
      const currentSymbol = state.bySymbol[symbol] ?? buildEmptySymbolMetrics()
      const currentStream = currentSymbol.streams[stream] ?? buildEmptyStream()

      let windowStart = currentStream._windowStart ?? receivedAt
      let windowCount = (currentStream._windowCount ?? 0) + incrementBy
      let eventsPerSecond = currentStream.eventsPerSecond ?? 0

      if (receivedAt - windowStart >= ONE_SECOND_MS) {
        eventsPerSecond = windowCount
        windowStart = receivedAt
        windowCount = 0
      }

      const sampleValue = latency.backendToFrontendMs ?? latency.exchangeToFrontendMs ?? null
      const samples =
        sampleValue == null ? currentStream.samples : [...currentStream.samples, sampleValue].slice(-MAX_SAMPLES)

      const nextBySymbol = {
        ...state.bySymbol,
        [symbol]: {
          ...currentSymbol,
          streams: {
            ...currentSymbol.streams,
            [stream]: {
              ...currentStream,
              ...latency,
              lastReceivedAt: receivedAt,
              lastReceivedAtWall: receivedAtWall,
              eventsPerSecond,
              _windowStart: windowStart,
              _windowCount: windowCount,
              samples,
              p95BackendToFrontendMs: percentile(samples, 95),
            },
          },
        },
      }

      // Evict the oldest symbol when the symbol cap is exceeded so the store
      // never grows beyond MAX_TRACKED_SYMBOLS entries in memory.
      if (!(symbol in state.bySymbol) && Object.keys(nextBySymbol).length > MAX_TRACKED_SYMBOLS) {
        const toEvict = findOldestSymbol(nextBySymbol, symbol)
        if (toEvict) delete nextBySymbol[toEvict]
      }

      return { bySymbol: nextBySymbol }
    })
  },

  recordRender: (symbol, component, durationMs) => {
    if (!symbol || !component || !Number.isFinite(durationMs)) return

    set((state) => {
      const currentSymbol = state.bySymbol[symbol] ?? buildEmptySymbolMetrics()
      const currentRender = currentSymbol.render[component] ?? { lastMs: null, maxMs: null, samples: [] }
      const samples = [...currentRender.samples, durationMs].slice(-MAX_SAMPLES)

      return {
        bySymbol: {
          ...state.bySymbol,
          [symbol]: {
            ...currentSymbol,
            render: {
              ...currentSymbol.render,
              [component]: {
                lastMs: durationMs,
                maxMs: Math.max(currentRender.maxMs ?? 0, durationMs),
                p95Ms: percentile(samples, 95),
                samples,
              },
            },
          },
        },
      }
    })
  },

  pruneSymbol: (symbol) => {
    if (!symbol) return
    set((state) => {
      if (!(symbol in state.bySymbol)) return state
      const next = { ...state.bySymbol }
      delete next[symbol]
      return { bySymbol: next }
    })
  },
}))

const EMPTY_SYMBOL_METRICS = Object.freeze({ streams: Object.freeze({}), render: Object.freeze({}) })
const EMPTY_STREAM_METRICS = Object.freeze({
  lastReceivedAt: null,
  lastReceivedAtWall: null,
  eventsPerSecond: 0,
  _windowStart: 0,
  _windowCount: 0,
  samples: Object.freeze([]),
  backendAuthoritativeMs: null,
  backendToFrontendMs: null,
  transportToFrontendMs: null,
  exchangeToFrontendMs: null,
  backendProcessingMs: null,
  p95BackendToFrontendMs: null,
})

export const selectSymbolMetrics = (symbol) => (state) => state.bySymbol[symbol] ?? EMPTY_SYMBOL_METRICS
export const selectStreamMetrics = (symbol, stream) => (state) =>
  state.bySymbol[symbol]?.streams?.[stream] ?? EMPTY_STREAM_METRICS
