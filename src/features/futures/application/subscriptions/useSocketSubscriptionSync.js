import { useEffect, useRef } from 'react'
import { useSubscriptionPlanStore, snapshotPlan } from './subscriptionPlanStore'
import {
  subscribeSymbol,
  unsubscribeSymbol,
  onConnectionChange,
  getConnectionStatus,
} from '../../infrastructure/futuresSocketClient'
import { useRealtimeMetricsStore } from '../../observability/realtimeMetricsStore'
import { useMarketDataStore } from '../stores/marketDataStore'
import { useOrderBookStore } from '../stores/orderBookStore'
import { useOrderFlowStore } from '../stores/orderFlowStore'
import { useSignalStore } from '../stores/signalStore'
import { useFuturesConnectionStore } from '../stores/futuresConnectionStore'
import { usePaperTradeStore } from '../stores/paperTradeStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { useFuturesRealtimeStore } from '../futuresRealtimeStore'

/**
 * Debounce window (ms) for collapsing rapid plan changes into a single
 * SUBSCRIBE_ASSET emit. Configurable via REACT_APP_SUBSCRIPTION_SYNC_DEBOUNCE_MS.
 */
const SYNC_DEBOUNCE_MS = (() => {
  const raw = Number(process.env.REACT_APP_SUBSCRIPTION_SYNC_DEBOUNCE_MS)
  return Number.isFinite(raw) && raw >= 0 ? raw : 150
})()

function arraysEqual(a, b) {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false
  return true
}

/**
 * Single source that observes the global subscription plan for `symbol` and
 * issues `SUBSCRIBE_ASSET` / `UNSUBSCRIBE_ASSET` to the backend, debounced.
 *
 * Replaces the old pattern where every hook called `subscribeSymbol` with
 * its own hard-coded intervals list. Now the emitted intervals are the union
 * of what active features actually need.
 *
 * Should be invoked once per dashboard for the currently focused symbol.
 */
export function useSocketSubscriptionSync(symbol) {
  const lastSentRef = useRef({ features: [], intervals: [] })
  const subscribedSymbolRef = useRef(null)
  const debounceTimerRef = useRef(null)

  useEffect(() => {
    if (!symbol) return undefined

    const flush = () => {
      debounceTimerRef.current = null
      const plan = useSubscriptionPlanStore.getState().plans.get(symbol)
      const snap = snapshotPlan(plan)
      const last = lastSentRef.current

      const isSameSymbol = subscribedSymbolRef.current === symbol
      const featuresEqual = arraysEqual(snap.features, last.features)
      const intervalsEqual = arraysEqual(snap.intervals, last.intervals)
      if (isSameSymbol && featuresEqual && intervalsEqual) return

      if (snap.intervals.length === 0 && snap.features.length === 0) {
        if (subscribedSymbolRef.current) {
          unsubscribeSymbol(subscribedSymbolRef.current)
          useRealtimeMetricsStore.getState().recordEvent(
            subscribedSymbolRef.current,
            'subscription.churn',
            { kind: 'unsubscribe', features: [], intervals: [] },
            1,
          )
          subscribedSymbolRef.current = null
          lastSentRef.current = { features: [], intervals: [] }
        }
        return
      }

      subscribeSymbol(symbol, snap.intervals, { features: snap.features })
      useRealtimeMetricsStore.getState().recordEvent(
        symbol,
        'subscription.churn',
        { kind: 'subscribe', features: snap.features, intervals: snap.intervals },
        1,
      )
      subscribedSymbolRef.current = symbol
      lastSentRef.current = snap
    }

    const schedule = () => {
      if (debounceTimerRef.current != null) return
      debounceTimerRef.current = setTimeout(flush, SYNC_DEBOUNCE_MS)
    }

    const unsubscribeStore = useSubscriptionPlanStore.subscribe(schedule)

    const handleConnection = (status) => {
      if (status !== 'connected') return
      // Force resubscribe on reconnect.
      lastSentRef.current = { features: [], intervals: [] }
      schedule()
    }
    const detachConnection = onConnectionChange(handleConnection)
    if (getConnectionStatus() === 'connected') schedule()

    return () => {
      if (debounceTimerRef.current != null) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      detachConnection()
      unsubscribeStore()
      if (subscribedSymbolRef.current) {
        const sym = subscribedSymbolRef.current
        unsubscribeSymbol(sym)
        subscribedSymbolRef.current = null
        // Evict all per-symbol data so stores don't grow unbounded.
        useMarketDataStore.getState().cleanupSymbol(sym)
        useOrderBookStore.getState().cleanupSymbol(sym)
        useOrderFlowStore.getState().cleanupSymbol(sym)
        useSignalStore.getState().cleanupSymbol(sym)
        useFuturesConnectionStore.getState().cleanupSymbol(sym)
        usePaperTradeStore.getState().cleanupSymbol(sym)
        usePortfolioStore.getState().cleanupSymbol(sym)
        useFuturesRealtimeStore.getState().cleanupSymbol(sym)
        useRealtimeMetricsStore.getState().pruneSymbol(sym)
      }
      lastSentRef.current = { features: [], intervals: [] }
    }
  }, [symbol])
}
