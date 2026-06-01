import { useState } from 'react'
import { useFuturesAssetContext } from '../../application/useFuturesAssetContext'
import { useFuturesAssetRealtime } from '../../application/useFuturesAssetRealtime'
import { useLiquidityData } from '../../application/useLiquidityData'
import { useSocketSubscriptionSync } from '../../application/subscriptions/useSocketSubscriptionSync'
import { useMarketDataStore, selectServerContextBySymbol } from '../../application/stores/marketDataStore'
import {
  useSignalStore,
  selectSpoofingCandidatesBySymbol,
  selectLiquidityShiftsBySymbol,
} from '../../application/stores/signalStore'
import { INTERVALS as TIMEFRAMES } from '../../domain/timeframes'

// Re-export so existing imports (`ChartSection`, `FuturesAssetDashboard`)
// keep working. Source of truth lives in `domain/timeframes`.
export const INTERVALS = TIMEFRAMES

export function useFuturesDashboardState() {
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [intervalIdx, setIntervalIdx] = useState(0)
  const [bottomTab, setBottomTab] = useState(0)

  const activeInterval = INTERVALS[intervalIdx] ?? INTERVALS[0]

  // Single place where the websocket subscribe is emitted, taking the union
  // of every feature/interval registered by mounted hooks (debounced).
  useSocketSubscriptionSync(symbol)

  const { context, loading, error } = useFuturesAssetContext(symbol)
  // Phase 1 — register all supported TFs for `candles` so 1h/4h actually
  // stream. The backend (tv1 FuturesAssetSocketAdapter) currently ignores
  // re-subscribes for the same symbol, so we need the full set on the first
  // emit. Once the backend accepts interval-delta on resubscribe, this can
  // collapse to `[activeInterval]`.
  const { connectionStatus } = useFuturesAssetRealtime(symbol, INTERVALS)
  const { imbalanceHistory } = useLiquidityData(symbol, { heatmapEnabled: false })
  const spoofingEvents = useSignalStore(selectSpoofingCandidatesBySymbol(symbol))
  const shiftEvents = useSignalStore(selectLiquidityShiftsBySymbol(symbol))

  const serverContext = useMarketDataStore(selectServerContextBySymbol(symbol))

  const activeContext = serverContext ?? context
  const posCount = activeContext?.positions?.length ?? 0
  const orderCount = activeContext?.openOrders?.length ?? 0

  return {
    // UI state
    symbol,
    setSymbol,
    intervalIdx,
    setIntervalIdx,
    bottomTab,
    setBottomTab,
    activeInterval,
    // Raw data
    context,
    loading,
    error,
    connectionStatus,
    // Phase 2 — same data, more honest name. `imbalanceHistory` kept for
    // backwards compat; new code should use `orderbookImbalanceHistory`.
    orderbookImbalanceHistory: imbalanceHistory,
    imbalanceHistory,
    spoofingEvents,
    shiftEvents,
    serverContext,
    // Derived
    activeContext,
    posCount,
    orderCount,
  }
}
