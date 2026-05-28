import { useEffect } from 'react'
import { useSubscriptionPlanStore } from './subscriptionPlanStore'

/**
 * Registers a (symbol, feature, interval?) tuple in the global subscription
 * plan store while the calling component is mounted. On unmount or when any
 * of the arguments changes, the previous tuple is unregistered.
 *
 * The actual websocket subscribe/unsubscribe is performed by
 * `useSocketSubscriptionSync`, which observes the aggregated plan.
 *
 * Use `interval = null` for microstructure features (orderbook, ticker, tape,
 * spoofing, liquidityShifts, signals) that are not timeframe-bound.
 */
export function useFeatureSubscription(symbol, feature, interval = null) {
  useEffect(() => {
    if (!symbol || !feature) return undefined
    const { register, unregister } = useSubscriptionPlanStore.getState()
    register(symbol, feature, interval)
    return () => unregister(symbol, feature, interval)
  }, [symbol, feature, interval])
}
