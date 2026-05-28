import { create } from 'zustand';

export const EMPTY_ARRAY = Object.freeze([]);
export const EMPTY_OBJECT = Object.freeze({});
export const EMPTY_CANDLES = Object.freeze({});
export const EMPTY_HEALTH = Object.freeze({
  bookSynced: false,
  lastUpdateAgeMs: null,
  resyncCount: 0,
  gapCount: 0,
  wsReconnectCount: 0,
});

export const EMPTY_REALTIME_SLICE = Object.freeze({
  topOfBook: null,
  orderBook: null,
  candles: EMPTY_CANDLES,
  recentTrades: EMPTY_ARRAY,
  markPrice: null,
  cvdHistory: EMPTY_ARRAY,
  footprint: null,
  liquidityShifts: EMPTY_ARRAY,
  spoofingCandidates: EMPTY_ARRAY,
  serverContext: null,
  ticker: null,
  socketError: null,
  health: EMPTY_HEALTH,
});

const MIN_LIQUIDITY_EVENT_MS = 250;
const lastLiquidityEventBySymbol = new Map();
const lastSpoofingEventBySymbol = new Map();

function eventKey(event) {
  if (!event) return '';
  return [
    event.id,
    event.ts ?? event.time ?? event.timestamp,
    event.side,
    event.type,
    event.price,
    event.level,
    event.quantity ?? event.qty,
  ].filter((v) => v !== undefined && v !== null).join('|');
}

function shouldAcceptHighFrequencyEvent(cache, symbol, event, minMs = MIN_LIQUIDITY_EVENT_MS) {
  const now = Date.now();
  const key = eventKey(event);
  const previous = cache.get(symbol);

  if (previous && previous.key === key) return false;
  if (previous && now - previous.time < minMs) return false;

  cache.set(symbol, { key, time: now });
  return true;
}

export const createEmptyRealtimeSlice = () => ({
  topOfBook: null,
  orderBook: null,
  candles: {},
  recentTrades: [],
  markPrice: null,
  cvdHistory: [],
  footprint: null,
  liquidityShifts: [],
  spoofingCandidates: [],
  serverContext: null,
  ticker: null,
  socketError: null,
  health: {
    bookSynced: false,
    lastUpdateAgeMs: null,
    resyncCount: 0,
    gapCount: 0,
    wsReconnectCount: 0,
  },
});

export const useFuturesRealtimeStore = create((set, get) => ({
  bySymbol: {},
  connectionStatus: 'disconnected',

  resetSymbol: (symbol) => {
    if (!symbol) return;
    lastLiquidityEventBySymbol.delete(symbol);
    lastSpoofingEventBySymbol.delete(symbol);
    set((state) => ({
      bySymbol: {
        ...state.bySymbol,
        [symbol]: createEmptyRealtimeSlice(),
      },
    }));
  },

  /** Fully evict a symbol from memory (call when navigating away). */
  cleanupSymbol: (symbol) => {
    if (!symbol) return;
    lastLiquidityEventBySymbol.delete(symbol);
    lastSpoofingEventBySymbol.delete(symbol);
    set((state) => {
      if (!(symbol in state.bySymbol)) return state;
      const next = { ...state.bySymbol };
      delete next[symbol];
      return { bySymbol: next };
    });
  },

  setConnectionStatus: (connectionStatus) => {
    set((state) => (state.connectionStatus === connectionStatus ? state : { connectionStatus }));
  },

  patchSymbol: (symbol, patchOrUpdater) => {
    if (!symbol) return;
    set((state) => {
      const current = state.bySymbol[symbol] ?? createEmptyRealtimeSlice();
      const patch = typeof patchOrUpdater === 'function'
        ? patchOrUpdater(current)
        : patchOrUpdater;

      if (!patch || Object.keys(patch).length === 0) return state;

      return {
        bySymbol: {
          ...state.bySymbol,
          [symbol]: {
            ...current,
            ...patch,
          },
        },
      };
    });
  },

  setCandles: (symbol, interval, candles) => {
    if (!symbol || !interval) return;
    get().patchSymbol(symbol, (current) => {
      if (current.candles[interval] === candles) return {};
      return {
        candles: {
          ...current.candles,
          [interval]: candles,
        },
      };
    });
  },

  upsertCandle: (symbol, interval, candle, maxLength = 500) => {
    if (!symbol || !interval || candle?.openTime == null) return;
    get().patchSymbol(symbol, (current) => {
      const prevList = current.candles[interval] || EMPTY_ARRAY;
      const idx = prevList.findIndex((c) => c.openTime === candle.openTime);
      if (idx >= 0 && prevList[idx] === candle) return {};

      const updated = idx >= 0 ? [...prevList] : [...prevList, candle].slice(-maxLength);
      if (idx >= 0) updated[idx] = candle;
      return {
        candles: {
          ...current.candles,
          [interval]: updated,
        },
      };
    });
  },

  prependTrades: (symbol, trades, maxLength = 200) => {
    if (!symbol) return;
    const batch = Array.isArray(trades) ? trades : [trades];
    if (batch.length === 0) return;
    get().patchSymbol(symbol, (current) => ({
      recentTrades: [...batch, ...current.recentTrades].slice(0, maxLength),
    }));
  },

  appendCvd: (symbol, event, maxLength = 600) => {
    if (!symbol || !event) return;
    get().patchSymbol(symbol, (current) => {
      const last = current.cvdHistory[current.cvdHistory.length - 1];
      if (eventKey(last) && eventKey(last) === eventKey(event)) return {};
      return {
        cvdHistory: [...current.cvdHistory, event].slice(-maxLength),
      };
    });
  },

  prependLiquidityShift: (symbol, event, maxLength = 100) => {
    if (!symbol || !event) return;
    if (!shouldAcceptHighFrequencyEvent(lastLiquidityEventBySymbol, symbol, event)) return;
    get().patchSymbol(symbol, (current) => ({
      liquidityShifts: [event, ...current.liquidityShifts].slice(0, maxLength),
    }));
  },

  prependSpoofingCandidate: (symbol, event, maxLength = 50) => {
    if (!symbol || !event) return;
    if (!shouldAcceptHighFrequencyEvent(lastSpoofingEventBySymbol, symbol, event, 500)) return;
    get().patchSymbol(symbol, (current) => ({
      spoofingCandidates: [event, ...current.spoofingCandidates].slice(0, maxLength),
    }));
  },
}));

export const selectRealtimeBySymbol = (symbol) => (state) => state.bySymbol[symbol] ?? EMPTY_REALTIME_SLICE;
export const selectConnectionStatus = (state) => state.connectionStatus;
export const selectOrderBookBySymbol = (symbol) => (state) => state.bySymbol[symbol]?.orderBook ?? null;
export const selectCvdBySymbol = (symbol) => (state) => state.bySymbol[symbol]?.cvdHistory ?? EMPTY_ARRAY;
export const selectTradesBySymbol = (symbol) => (state) => state.bySymbol[symbol]?.recentTrades ?? EMPTY_ARRAY;
export const selectCandlesBySymbolInterval = (symbol, interval) => (state) => state.bySymbol[symbol]?.candles?.[interval] ?? EMPTY_ARRAY;
export const selectHealthBySymbol = (symbol) => (state) => state.bySymbol[symbol]?.health ?? EMPTY_HEALTH;
