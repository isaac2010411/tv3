import { useEffect } from 'react'
import { fetchFootprintHistory } from '../infrastructure/futuresApiClient'
import { useFeatureSubscription } from './subscriptions/useFeatureSubscription'
import {
  useOrderFlowStore,
  selectCurrentFootprintBySymbol,
  selectFootprintHistoryBySymbol,
} from './stores/orderFlowStore'

/**
 * Reads footprint candles from the centralized order-flow store populated by
 * `useFuturesAssetRealtime`.
 *
 * This hook still registers the desired `footprint` feature in the subscription
 * plan, but it no longer attaches Socket.IO listeners. That keeps one active
 * listener for `futures:orderflow:footprint` in the whole dashboard and avoids
 * duplicate callbacks when footprint panels mount/unmount.
 *
 * @param {string} symbol
 * @param {string} interval  active timeframe (must be a single TF)
 * @returns {{
 *   footprints:        Map<string, import('../domain/footprint.model').FootprintDisplay[]>,
 *   currentFootprints: Map<string, import('../domain/footprint.model').FootprintDisplay>,
 * }}
 */
export function useFootprintCandles(symbol, interval) {
  useFeatureSubscription(symbol, 'footprint', interval ?? null)

  const footprints = useOrderFlowStore(selectFootprintHistoryBySymbol(symbol))
  const currentFootprints = useOrderFlowStore(selectCurrentFootprintBySymbol(symbol))

  useEffect(() => {
    if (!symbol || !interval) return undefined

    let cancelled = false
    fetchFootprintHistory(symbol, interval, 50)
      .then((rawList) => {
        if (cancelled) return
        const current = useOrderFlowStore.getState().footprintHistoryBySymbol[symbol]
        if ((current?.get(interval) ?? []).length > 0) return
        useOrderFlowStore.getState().setFootprintHistory(symbol, interval, rawList, 200)
      })
      .catch(() => {
        /* silently ignore — chart just starts empty */
      })

    return () => {
      cancelled = true
    }
  }, [symbol, interval])

  return { footprints, currentFootprints }
}
