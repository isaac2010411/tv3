import { useEffect, useRef, useState } from 'react'
import { useFeatureSubscription } from './subscriptions/useFeatureSubscription'
import { useOrderBookStore, selectBookMetricsBySymbol } from './stores/orderBookStore'

const MAX_IMBALANCE_HISTORY = 180
const MAX_HEATMAP_SNAPSHOTS = 180
const MAX_HEATMAP_LEVELS = 40
const FLUSH_INTERVAL_MS = 250
const FLUSH_INTERVAL_IDLE_MS = 500

/**
 * Keeps bounded display windows for backend-derived liquidity metrics.
 * Domain math lives in tv1; this hook only stores recent points for charts.
 *
 * @param {string} symbol
 */
export function useLiquidityData(symbol, options = {}) {
  const heatmapEnabled = options?.heatmapEnabled !== false
  const [heatmapMinutes, setHeatmapMinutes] = useState(5)
  const [heatmapSnapshots, setHeatmapSnapshots] = useState([])
  const [imbalanceHistory, setImbalanceHistory] = useState([])
  const bookMetrics = useOrderBookStore(selectBookMetricsBySymbol(symbol))

  useFeatureSubscription(symbol, 'orderbookImbalance', null)
  useFeatureSubscription(symbol, heatmapEnabled ? 'heatmap' : null, null)

  const heatmapRingRef = useRef([])
  const imbalanceRingRef = useRef([])
  const maxSnapshotsRef = useRef(heatmapMinutes * 60)
  const lastMetricsTsRef = useRef(null)

  useEffect(() => {
    maxSnapshotsRef.current = Math.min(MAX_HEATMAP_SNAPSHOTS, heatmapMinutes * 30)
  }, [heatmapMinutes])

  useEffect(() => {
    if (!symbol) return
    const flushInterval = heatmapEnabled ? FLUSH_INTERVAL_MS : FLUSH_INTERVAL_IDLE_MS
    const id = setInterval(() => {
      if (heatmapEnabled) setHeatmapSnapshots(heatmapRingRef.current.slice())
      setImbalanceHistory(imbalanceRingRef.current.slice())
    }, flushInterval)
    return () => clearInterval(id)
  }, [symbol, heatmapEnabled])

  useEffect(() => {
    if (!symbol || !bookMetrics) return
    const now = bookMetrics.timestamp ?? Date.now()
    if (lastMetricsTsRef.current === now) return
    lastMetricsTsRef.current = now

    if (heatmapEnabled && bookMetrics.heatmapSnapshot) {
      const hRing = heatmapRingRef.current
      hRing.push({
        ...bookMetrics.heatmapSnapshot,
        bids: (bookMetrics.heatmapSnapshot.bids ?? []).slice(0, MAX_HEATMAP_LEVELS),
        asks: (bookMetrics.heatmapSnapshot.asks ?? []).slice(0, MAX_HEATMAP_LEVELS),
        timestamp: now,
      })
      if (hRing.length > maxSnapshotsRef.current) {
        heatmapRingRef.current = hRing.slice(-maxSnapshotsRef.current)
      }
    }

    const imbalance = Number(bookMetrics.imbalanceTop10 ?? bookMetrics.imbalance)
    if (Number.isFinite(imbalance)) {
      const iRing = imbalanceRingRef.current
      iRing.push({ time: now, value: imbalance })
      if (iRing.length > MAX_IMBALANCE_HISTORY) {
        imbalanceRingRef.current = iRing.slice(-MAX_IMBALANCE_HISTORY)
      }
    }
  }, [symbol, bookMetrics, heatmapEnabled])

  useEffect(() => {
    heatmapRingRef.current = []
    imbalanceRingRef.current = []
    lastMetricsTsRef.current = null
    setHeatmapSnapshots([])
    setImbalanceHistory([])
  }, [symbol])

  useEffect(() => {
    const maxSnaps = Math.min(MAX_HEATMAP_SNAPSHOTS, heatmapMinutes * 30)
    heatmapRingRef.current = heatmapRingRef.current.slice(-maxSnaps)
    setHeatmapSnapshots((prev) => (prev.length > maxSnaps ? prev.slice(-maxSnaps) : prev))
  }, [heatmapMinutes])

  return {
    heatmapSnapshots,
    imbalanceHistory,
    orderbookImbalanceHistory: imbalanceHistory,
    heatmapMinutes,
    setHeatmapMinutes,
  }
}
