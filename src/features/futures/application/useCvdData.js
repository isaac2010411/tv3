import { useMemo } from 'react'
import { useFeatureSubscription } from './subscriptions/useFeatureSubscription'
import { useOrderFlowStore, selectCvdHistoryBySymbol } from './stores/orderFlowStore'

function eventInterval(event) {
  return event?.interval ?? event?.i ?? null
}

/**
 * Reads CVD data from the centralized order-flow store populated by
 * `useFuturesAssetRealtime`.
 *
 * This hook still registers the desired `cvd` feature in the subscription plan,
 * but it no longer attaches its own Socket.IO listener. Keeping a single CVD
 * listener avoids duplicate callbacks when dashboard panels mount/unmount.
 *
 * If `interval` is provided, only tv1-tagged events for that timeframe are
 * exposed.
 *
 * @param {string}  symbol
 * @param {string} [interval] active timeframe; omit for legacy global stream
 * @returns {{ cvd: number, cvdHistory: object[] }}
 */
export function useCvdData(symbol, interval) {
  useFeatureSubscription(symbol, 'cvd', interval ?? null)

  const storeHistory = useOrderFlowStore(selectCvdHistoryBySymbol(symbol))

  const cvdHistory = useMemo(() => {
    if (!interval) return storeHistory
    return storeHistory.filter((event) => {
      const evInterval = eventInterval(event)
      return evInterval === interval
    })
  }, [storeHistory, interval])

  const last = cvdHistory[cvdHistory.length - 1]
  const cvd = Number.parseFloat(last?.cvd ?? last?.value ?? 0) || 0

  return { cvd, cvdHistory }
}
