import { useEffect, useRef, useState } from 'react'
import { useFeatureSubscription } from './subscriptions/useFeatureSubscription'
import { useOrderBookStore, selectBookMetricsBySymbol } from './stores/orderBookStore'

const MAX_IMBALANCE_HISTORY = 180
const FLUSH_INTERVAL_MS = 500

/**
 * Keeps bounded display windows for backend-derived liquidity metrics.
 * Domain math lives in tv1; this hook only stores recent points for charts.
 *
 * @param {string} symbol
 */
export function useLiquidityData(symbol) {
  const [imbalanceHistory, setImbalanceHistory] = useState([])
  const bookMetrics = useOrderBookStore(selectBookMetricsBySymbol(symbol))

  useFeatureSubscription(symbol, 'orderbookImbalance', null)

  const imbalanceRingRef = useRef([])
  const lastMetricsTsRef = useRef(null)

  useEffect(() => {
    if (!symbol) return
    const id = setInterval(() => {
      setImbalanceHistory(imbalanceRingRef.current.slice())
    }, FLUSH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [symbol])

  useEffect(() => {
    if (!symbol || !bookMetrics) return
    const now = bookMetrics.timestamp ?? Date.now()
    if (lastMetricsTsRef.current === now) return
    lastMetricsTsRef.current = now

    const imbalance = Number(bookMetrics.imbalanceTop10 ?? bookMetrics.imbalance)
    if (Number.isFinite(imbalance)) {
      const iRing = imbalanceRingRef.current
      iRing.push({ time: now, value: imbalance })
      if (iRing.length > MAX_IMBALANCE_HISTORY) {
        imbalanceRingRef.current = iRing.slice(-MAX_IMBALANCE_HISTORY)
      }
    }
  }, [symbol, bookMetrics])

  useEffect(() => {
    imbalanceRingRef.current = []
    lastMetricsTsRef.current = null
    setImbalanceHistory([])
  }, [symbol])

  return {
    imbalanceHistory,
    orderbookImbalanceHistory: imbalanceHistory,
  }
}
