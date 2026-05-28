import { useSocketSubscriptionSync } from './useSocketSubscriptionSync'

/**
 * Phase 7 — drive the subscription sync for every symbol in an arbitrary
 * watchlist. Each symbol has its own independent plan in
 * `subscriptionPlanStore`, so calling this for `['BTCUSDT','ETHUSDT']`
 * results in two independent socket subscribes whose diffs are debounced
 * separately.
 *
 * Usage:
 *   useSocketSubscriptionSyncMany(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'])
 *
 * Hooks rule note: this calls `useSocketSubscriptionSync` once per symbol
 * in a stable order, so the symbol array must be order-stable across renders
 * (e.g. sorted, or coming from a memoised selector). If the array length
 * varies, wrap the caller in a key-changing parent or split per-symbol into
 * a child component.
 */
export function useSocketSubscriptionSyncMany(symbols) {
  const list = Array.isArray(symbols) ? symbols : []
  for (const symbol of list) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSocketSubscriptionSync(symbol)
  }
}
