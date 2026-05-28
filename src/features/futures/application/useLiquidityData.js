import { useEffect, useRef, useState, useCallback } from 'react'
import { onEvent, offEvent } from '../infrastructure/futuresSocketClient'
import { useFeatureSubscription } from './subscriptions/useFeatureSubscription'

const MAX_IMBALANCE_HISTORY = 300 // ~5 min at 1 update/sec
/** Flush ring-buffer refs to React state at this rate (ms). 100 ms = 10 fps. */
const FLUSH_INTERVAL_MS = 100
const FLUSH_INTERVAL_IDLE_MS = 500
const IMBALANCE_DEPTH = 10
/** Phase 5.2 — keep only the top N levels per side per heatmap snapshot. */
const HEATMAP_LEVELS_PER_SIDE = 30

function eventSymbol(event) {
  return event?.symbol ?? event?.s ?? null
}

function parsePositiveQty(level) {
  const rawQty = Array.isArray(level) ? level[1] : level?.quantity ?? level?.qty
  const qty = Number.parseFloat(rawQty)
  return Number.isFinite(qty) && qty > 0 ? qty : 0
}

function calcImbalanceFromRawBook(bids = [], asks = [], depth = IMBALANCE_DEPTH) {
  let bidVol = 0
  let askVol = 0

  const bidLevels = Math.min(depth, bids.length)
  const askLevels = Math.min(depth, asks.length)

  for (let i = 0; i < bidLevels; i += 1) {
    bidVol += parsePositiveQty(bids[i])
  }
  for (let i = 0; i < askLevels; i += 1) {
    askVol += parsePositiveQty(asks[i])
  }

  const total = bidVol + askVol
  if (!total || !Number.isFinite(total)) return 0
  const imbalance = (bidVol - askVol) / total
  return Number.isFinite(imbalance) ? imbalance : 0
}

/**
 * Accumulates data from the `futures:book:local` stream (reconstructed by
 * the backend from diff-depth) to build the liquidity heatmap and imbalance
 * time-series. The legacy `futures:book:partial` stream is no longer
 * subscribed since the backend gates it behind EMIT_BOOK_PARTIAL=true.
 *
 * Hot path (handleOrderBook) writes only to mutable refs so no React
 * re-renders occur per-event. A fixed-rate interval flushes ref data to
 * state at 10 fps, capping heatmap render frequency regardless of how fast
 * Binance sends depth updates.
 *
 * Phase 5.2 memory cap: each heatmap snapshot keeps only the top
 * HEATMAP_LEVELS_PER_SIDE levels per side. This bounds memory at
 * `max_snapshots × HEATMAP_LEVELS_PER_SIDE × 2 × ~32 bytes`.
 *
 * @param {string} symbol
 */
export function useLiquidityData(symbol, options = {}) {
  const heatmapEnabled = options?.heatmapEnabled !== false
  const [heatmapMinutes, setHeatmapMinutes] = useState(5)
  const [heatmapSnapshots, setHeatmapSnapshots] = useState([])
  const [imbalanceHistory, setImbalanceHistory] = useState([])

  // Microstructure features — NOT timeframe-bound.
  // `orderbookImbalance` is always registered while the hook is mounted;
  // `heatmap` only when the user actually opens that tab so we don't pay the
  // snapshot accumulation cost for nothing.
  useFeatureSubscription(symbol, 'orderbookImbalance', null)
  useFeatureSubscription(symbol, heatmapEnabled ? 'heatmap' : null, null)

  // Mutable ring buffers — written from WebSocket callbacks without touching React state.
  const heatmapRingRef = useRef([])
  const imbalanceRingRef = useRef([])
  const maxSnapshotsRef = useRef(heatmapMinutes * 60)

  useEffect(() => {
    maxSnapshotsRef.current = heatmapMinutes * 60
  }, [heatmapMinutes])

  // ── Flush refs → state at 10 fps ───────────────────────────────────────────
  useEffect(() => {
    if (!symbol) return
    const flushInterval = heatmapEnabled ? FLUSH_INTERVAL_MS : FLUSH_INTERVAL_IDLE_MS
    const id = setInterval(() => {
      // Avoid pushing frequent heatmap snapshots to React while the heatmap tab is hidden.
      if (heatmapEnabled) {
        setHeatmapSnapshots(heatmapRingRef.current.slice())
      }
      setImbalanceHistory(imbalanceRingRef.current.slice())
    }, flushInterval)
    return () => clearInterval(id)
  }, [symbol, heatmapEnabled])

  // ── Event handlers ────────────────────────────────────────────────────────
  const handleOrderBook = useCallback((data) => {
    const payloadSymbol = eventSymbol(data)
    if (payloadSymbol && payloadSymbol !== symbol) return

    const now = Date.now()
    const max = maxSnapshotsRef.current

    // Heatmap ring — store only top N levels per side to bound memory
    if (heatmapEnabled) {
      const bids = Array.isArray(data.bids) ? data.bids.slice(0, HEATMAP_LEVELS_PER_SIDE) : []
      const asks = Array.isArray(data.asks) ? data.asks.slice(0, HEATMAP_LEVELS_PER_SIDE) : []
      const hRing = heatmapRingRef.current
      hRing.push({ bids, asks, timestamp: now })
      if (hRing.length > max) heatmapRingRef.current = hRing.slice(-max)
    }

    // Compute imbalance directly from top depth levels to avoid expensive full book transforms.
    const imbalance = calcImbalanceFromRawBook(data?.bids, data?.asks)
    const iRing = imbalanceRingRef.current
    iRing.push({ time: now, value: imbalance })
    if (iRing.length > MAX_IMBALANCE_HISTORY) imbalanceRingRef.current = iRing.slice(-MAX_IMBALANCE_HISTORY)
  }, [symbol, heatmapEnabled])

  // ── Subscribe / unsubscribe ───────────────────────────────────────────────
  useEffect(() => {
    if (!symbol) return

    heatmapRingRef.current = []
    imbalanceRingRef.current = []
    setHeatmapSnapshots([])
    setImbalanceHistory([])

    onEvent('futures:book:local', handleOrderBook)

    return () => {
      offEvent('futures:book:local', handleOrderBook)
    }
  }, [symbol, handleOrderBook])

  // Trim when user reduces the minutes window
  useEffect(() => {
    const maxSnaps = heatmapMinutes * 60
    heatmapRingRef.current = heatmapRingRef.current.slice(-maxSnaps)
    setHeatmapSnapshots((prev) => (prev.length > maxSnaps ? prev.slice(-maxSnaps) : prev))
  }, [heatmapMinutes])

  return {
    heatmapSnapshots,
    imbalanceHistory,
    // Phase 2 — explicit name. `imbalanceHistory` is the orderbook (microstructure)
    // imbalance, *not* a per-candle delta. Consumers should migrate to
    // `orderbookImbalanceHistory`; the legacy name is kept as an alias.
    orderbookImbalanceHistory: imbalanceHistory,
    heatmapMinutes,
    setHeatmapMinutes,
  }
}
