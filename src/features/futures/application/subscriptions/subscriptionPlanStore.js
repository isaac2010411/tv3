import { create } from 'zustand'

/**
 * Refcounted subscription plan per (symbol, feature, interval?).
 *
 * Each visible hook/widget registers what it needs. The store keeps a count
 * so multiple consumers of the same feature don't trigger duplicate
 * subscribe/unsubscribe. A separate sync layer (`useSocketSubscriptionSync`)
 * observes the resulting plan and emits to the socket, debounced.
 *
 * Plan shape (per symbol):
 *   {
 *     features: Map<feature, count>,                 // refcount of features without TF
 *     intervals: Map<interval, count>,               // refcount per interval, used for `candles` and TF-aware features
 *     featureIntervals: Map<`${feature}|${interval}`, count>, // fine-grained for stats
 *   }
 *
 * Known features:
 *   'candles' | 'orderbook' | 'orderbookImbalance' | 'cvd' | 'footprint'
 *   'tape' | 'heatmap' | 'liquidityShifts' | 'spoofing' | 'signals'
 */

export const PREFERRED_INTERVAL_ORDER = ['1m', '5m', '15m', '1h', '4h']

function intervalRank(interval) {
  const index = PREFERRED_INTERVAL_ORDER.indexOf(interval)
  return index === -1 ? PREFERRED_INTERVAL_ORDER.length : index
}

function sortIntervalsByPreferredOrder(intervals) {
  return Array.from(intervals).sort((a, b) => {
    const rankDiff = intervalRank(a) - intervalRank(b)
    if (rankDiff !== 0) return rankDiff
    return String(a).localeCompare(String(b))
  })
}

function newSymbolPlan() {
  return {
    features: new Map(),
    intervals: new Map(),
    featureIntervals: new Map(),
  }
}

function bumpKey(map, key, delta) {
  const next = (map.get(key) ?? 0) + delta
  if (next <= 0) map.delete(key)
  else map.set(key, next)
}

export const useSubscriptionPlanStore = create((set, get) => ({
  // Map<symbol, plan>
  plans: new Map(),

  register(symbol, feature, interval = null) {
    if (!symbol || !feature) return
    const plans = new Map(get().plans)
    const plan = plans.get(symbol) ?? newSymbolPlan()
    const nextPlan = {
      features: new Map(plan.features),
      intervals: new Map(plan.intervals),
      featureIntervals: new Map(plan.featureIntervals),
    }
    bumpKey(nextPlan.features, feature, +1)
    if (interval) {
      bumpKey(nextPlan.intervals, interval, +1)
      bumpKey(nextPlan.featureIntervals, `${feature}|${interval}`, +1)
    }
    plans.set(symbol, nextPlan)
    set({ plans })
  },

  unregister(symbol, feature, interval = null) {
    if (!symbol || !feature) return
    const plans = new Map(get().plans)
    const plan = plans.get(symbol)
    if (!plan) return
    const nextPlan = {
      features: new Map(plan.features),
      intervals: new Map(plan.intervals),
      featureIntervals: new Map(plan.featureIntervals),
    }
    bumpKey(nextPlan.features, feature, -1)
    if (interval) {
      bumpKey(nextPlan.intervals, interval, -1)
      bumpKey(nextPlan.featureIntervals, `${feature}|${interval}`, -1)
    }
    if (
      nextPlan.features.size === 0 &&
      nextPlan.intervals.size === 0 &&
      nextPlan.featureIntervals.size === 0
    ) {
      plans.delete(symbol)
    } else {
      plans.set(symbol, nextPlan)
    }
    set({ plans })
  },

  resetSymbol(symbol) {
    const plans = new Map(get().plans)
    if (plans.delete(symbol)) set({ plans })
  },
}))

export function selectPlanForSymbol(symbol) {
  return (state) => state.plans.get(symbol)
}

/**
 * Returns a stable, plain snapshot of features and intervals for a symbol,
 * suitable for diffing across renders.
 */
export function snapshotPlan(plan) {
  if (!plan) return { features: [], intervals: [] }
  return {
    features: Array.from(plan.features.keys()).sort(),
    intervals: sortIntervalsByPreferredOrder(plan.intervals.keys()),
  }
}
