/**
 * FuturesRealtimeContext – compatibility shim
 *
 * The realtime state has been migrated to segmented Zustand stores under
 * ./stores/.  This file re-exports the public API surface that was previously
 * provided by the React Context so that any remaining callers continue to work
 * without modification.
 *
 * New code should import directly from the appropriate store:
 *   stores/futuresConnectionStore  – connection status, health, socket errors
 *   stores/marketDataStore         – ticker, markPrice, serverContext, candles
 *   stores/orderBookStore          – orderBook, localBook, topOfBook
 *   stores/orderFlowStore          – recentTrades, cvdHistory, footprint
 *   stores/signalStore             – signalUpdate, liquidityShifts, spoofingCandidates
 *   stores/portfolioStore          – positions, openOrders
 */

export {
  EMPTY_HEALTH,
  useFuturesConnectionStore as useFuturesConnectionStoreRaw,
  selectConnectionStatus,
  selectHealthBySymbol,
  selectSocketErrorBySymbol,
} from './stores/futuresConnectionStore';

export {
  EMPTY_ARRAY,
  EMPTY_CANDLES,
  useMarketDataStore,
  selectTickerBySymbol,
  selectMarkPriceBySymbol,
  selectServerContextBySymbol,
  selectCandlesBySymbolInterval,
  selectAllCandlesBySymbol,
} from './stores/marketDataStore';

export {
  useOrderBookStore,
  selectOrderBookBySymbol,
  selectLocalBookBySymbol,
  selectTopOfBookBySymbol,
} from './stores/orderBookStore';

export {
  useOrderFlowStore,
  selectRecentTradesBySymbol,
  selectCvdHistoryBySymbol,
  selectFootprintBySymbol,
} from './stores/orderFlowStore';

export {
  useSignalStore,
  selectSignalUpdateBySymbol,
  selectLiquidityShiftsBySymbol,
  selectSpoofingCandidatesBySymbol,
} from './stores/signalStore';

// ── Legacy hook aliases ────────────────────────────────────────────────────
// These recreate the old named-hook API on top of the new stores so callers
// that still use the old names compile without changes.

import { useFuturesConnectionStore, selectHealthBySymbol, selectSocketErrorBySymbol } from './stores/futuresConnectionStore';
import {
  useMarketDataStore,
  selectTickerBySymbol,
  selectMarkPriceBySymbol,
  selectServerContextBySymbol,
  selectCandlesBySymbolInterval,
} from './stores/marketDataStore';
import { useOrderBookStore, selectOrderBookBySymbol, selectTopOfBookBySymbol } from './stores/orderBookStore';
import { useOrderFlowStore, selectRecentTradesBySymbol, selectCvdHistoryBySymbol } from './stores/orderFlowStore';
import {
  useSignalStore,
  selectSignalUpdateBySymbol,
  selectLiquidityShiftsBySymbol,
  selectSpoofingCandidatesBySymbol,
} from './stores/signalStore';
import { EMPTY_ARRAY } from './stores/marketDataStore';

export const EMPTY_REALTIME_SLICE = Object.freeze({});

export function useFuturesConnectionStatus() {
  return useFuturesConnectionStore((s) => s.connectionStatus);
}

export function useFuturesHealth(symbol) {
  return useFuturesConnectionStore(selectHealthBySymbol(symbol));
}

export function useFuturesSocketError(symbol) {
  return useFuturesConnectionStore(selectSocketErrorBySymbol(symbol));
}

export function useFuturesOrderBook(symbol) {
  return useOrderBookStore(selectOrderBookBySymbol(symbol));
}

export function useFuturesTopOfBook(symbol) {
  return useOrderBookStore(selectTopOfBookBySymbol(symbol));
}

export function useFuturesTicker(symbol) {
  return useMarketDataStore(selectTickerBySymbol(symbol));
}

export function useFuturesMarkPrice(symbol) {
  return useMarketDataStore(selectMarkPriceBySymbol(symbol));
}

export function useFuturesCandles(symbol, interval) {
  return useMarketDataStore(selectCandlesBySymbolInterval(symbol, interval));
}

export function useFuturesTrades(symbol) {
  return useOrderFlowStore(selectRecentTradesBySymbol(symbol));
}

export function useFuturesServerContext(symbol) {
  return useMarketDataStore(selectServerContextBySymbol(symbol));
}

export function useFuturesSignalUpdate(symbol) {
  return useSignalStore(selectSignalUpdateBySymbol(symbol));
}

/**
 * @deprecated Use individual store selectors in new code.
 * Assembles a per-symbol slice from all stores.  Every field update in any
 * store will cause a re-render of the consumer.
 */
export function useFuturesRealtimeSymbol(symbol) {
  const orderBook          = useOrderBookStore(selectOrderBookBySymbol(symbol));
  const topOfBook          = useOrderBookStore(selectTopOfBookBySymbol(symbol));
  const ticker             = useMarketDataStore(selectTickerBySymbol(symbol));
  const markPrice          = useMarketDataStore(selectMarkPriceBySymbol(symbol));
  const serverContext      = useMarketDataStore(selectServerContextBySymbol(symbol));
  const candles            = useMarketDataStore((s) => s.candlesBySymbol[symbol] ?? {});
  const recentTrades       = useOrderFlowStore(selectRecentTradesBySymbol(symbol));
  const cvdHistory         = useOrderFlowStore(selectCvdHistoryBySymbol(symbol));
  const footprint          = useOrderFlowStore((s) => s.footprintBySymbol[symbol] ?? null);
  const signalUpdate       = useSignalStore(selectSignalUpdateBySymbol(symbol));
  const liquidityShifts    = useSignalStore(selectLiquidityShiftsBySymbol(symbol));
  const spoofingCandidates = useSignalStore(selectSpoofingCandidatesBySymbol(symbol));
  const socketError        = useFuturesConnectionStore(selectSocketErrorBySymbol(symbol));
  const health             = useFuturesConnectionStore(selectHealthBySymbol(symbol));

  return {
    orderBook, localBook: null, topOfBook,
    ticker, markPrice, serverContext, candles,
    recentTrades, cvdHistory, footprint,
    signalUpdate, liquidityShifts, spoofingCandidates,
    socketError, health,
  };
}

// FuturesRealtimeProvider is no longer needed – Zustand stores are global.
// Kept as a passthrough so any remaining JSX wrapper doesn't break.
export function FuturesRealtimeProvider({ children }) {
  return children;
}

export function useFuturesRealtimeData() {
  return {};
}

export function useFuturesRealtimeActions() {
  return null;
}


