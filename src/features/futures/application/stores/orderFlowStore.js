/**
 * orderFlowStore
 *
 * High-frequency order-flow data: aggregated trades (tape), CVD history,
 * and footprint candles.  Isolated so a 10-Hz trade burst never causes
 * the OrderBook or Signal panels to re-render.
 */
import { create } from 'zustand';
import { appendCvdPoint } from '../../domain/cvd.model';
import { buildFootprintDisplay, upsertFootprint } from '../../domain/footprint.model';

export const EMPTY_ARRAY = Object.freeze([]);
export const EMPTY_MAP = Object.freeze(new Map());

function toMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1_000_000_000_000 ? n * 1000 : n;
}

function eventTime(event) {
  if (!event) return null;
  return (
    toMs(event?._meta?.exchangeEventTime) ??
    toMs(event.eventTime ?? event.E ?? event.ts ?? event.time ?? event.timestamp)
  );
}

function eventKey(event) {
  if (!event) return '';
  return [
    event?._meta?.stream,
    event?._meta?.streamSequence,
    event.aggregateTradeId,
    event.tradeId,
    event.id,
    event.ts ?? event.time ?? event.timestamp,
    event.side,
    event.type,
    event.price,
    event.quantity ?? event.qty,
  ]
    .filter((v) => v !== undefined && v !== null)
    .join('|');
}

function footprintInterval(event, display) {
  return event?.interval ?? event?.i ?? display?.interval ?? null;
}

export const useOrderFlowStore = create((set, get) => ({
  /** { [symbol]: TradeObject[] } */
  recentTradesBySymbol: {},

  /** { [symbol]: CvdPoint[] } */
  cvdHistoryBySymbol: {},

  /** { [symbol]: FootprintData | null } */
  footprintBySymbol: {},

  /** { [symbol]: Map<interval, FootprintDisplay[]> } */
  footprintHistoryBySymbol: {},

  /** { [symbol]: Map<interval, FootprintDisplay> } */
  currentFootprintBySymbol: {},

  // ── actions ───────────────────────────────────────────────────────────────

  resetSymbol(symbol) {
    if (!symbol) return;
    set((s) => ({
      recentTradesBySymbol: { ...s.recentTradesBySymbol, [symbol]: [] },
      cvdHistoryBySymbol:   { ...s.cvdHistoryBySymbol,   [symbol]: [] },
      footprintBySymbol:    { ...s.footprintBySymbol,    [symbol]: null },
      footprintHistoryBySymbol: { ...s.footprintHistoryBySymbol, [symbol]: new Map() },
      currentFootprintBySymbol: { ...s.currentFootprintBySymbol, [symbol]: new Map() },
    }));
  },

  /** Phase 5.5 — fully evict symbol slots */
  cleanupSymbol(symbol) {
    if (!symbol) return;
    set((s) => {
      const t = { ...s.recentTradesBySymbol }; delete t[symbol];
      const c = { ...s.cvdHistoryBySymbol };   delete c[symbol];
      const f = { ...s.footprintBySymbol };    delete f[symbol];
      const fh = { ...s.footprintHistoryBySymbol }; delete fh[symbol];
      const cf = { ...s.currentFootprintBySymbol }; delete cf[symbol];
      return {
        recentTradesBySymbol: t,
        cvdHistoryBySymbol: c,
        footprintBySymbol: f,
        footprintHistoryBySymbol: fh,
        currentFootprintBySymbol: cf,
      };
    });
  },

  prependTrades(symbol, trades, maxLength = 200) {
    if (!symbol) return;
    const batch = Array.isArray(trades) ? trades : [trades];
    if (batch.length === 0) return;
    const orderedBatch = [...batch].sort((a, b) => {
      const at = eventTime(a) ?? 0;
      const bt = eventTime(b) ?? 0;
      return bt - at;
    });
    const boundedBatch = orderedBatch.length > maxLength ? orderedBatch.slice(0, maxLength) : orderedBatch;
    set((s) => {
      const prev = s.recentTradesBySymbol[symbol] ?? EMPTY_ARRAY;
      return {
        recentTradesBySymbol: {
          ...s.recentTradesBySymbol,
          [symbol]: [...boundedBatch, ...prev].slice(0, maxLength),
        },
      };
    });
  },

  appendCvd(symbol, event, maxLength = 600) {
    if (!symbol || !event) return;
    set((s) => {
      const prev = s.cvdHistoryBySymbol[symbol] ?? EMPTY_ARRAY;
      const last = prev[prev.length - 1];
      if (last && eventKey(last) === eventKey(event)) return s;
      return {
        cvdHistoryBySymbol: {
          ...s.cvdHistoryBySymbol,
          [symbol]: appendCvdPoint(prev, event, maxLength),
        },
      };
    });
  },

  setFootprint(symbol, footprint) {
    if (!symbol) return;
    set((s) => ({
      footprintBySymbol: { ...s.footprintBySymbol, [symbol]: footprint },
    }));
  },

  setFootprintHistory(symbol, interval, rawList, maxItems = 200) {
    if (!symbol || !interval || !Array.isArray(rawList)) return;
    const parsed = rawList.map(buildFootprintDisplay).filter(Boolean);
    set((s) => {
      const prevByInterval = s.footprintHistoryBySymbol[symbol] ?? new Map();
      const nextByInterval = new Map(prevByInterval);
      nextByInterval.set(interval, parsed.length > maxItems ? parsed.slice(-maxItems) : parsed);
      return {
        footprintHistoryBySymbol: {
          ...s.footprintHistoryBySymbol,
          [symbol]: nextByInterval,
        },
      };
    });
  },

  upsertFootprint(symbol, event, maxItems = 200) {
    if (!symbol || !event?.footprint) return;
    const fp = buildFootprintDisplay(event.footprint);
    if (!fp) return;
    const interval = footprintInterval(event, fp);
    if (!interval) return;

    set((s) => {
      const prevHistoryByInterval = s.footprintHistoryBySymbol[symbol] ?? new Map();
      const nextHistoryByInterval = new Map(prevHistoryByInterval);
      const prevCurrentByInterval = s.currentFootprintBySymbol[symbol] ?? new Map();
      const nextCurrentByInterval = new Map(prevCurrentByInterval);

      if (fp.isFinal) {
        const history = nextHistoryByInterval.get(interval) ?? EMPTY_ARRAY;
        nextHistoryByInterval.set(interval, upsertFootprint(history, fp, maxItems));
        nextCurrentByInterval.delete(interval);
      } else {
        nextCurrentByInterval.set(interval, fp);
      }

      return {
        footprintHistoryBySymbol: {
          ...s.footprintHistoryBySymbol,
          [symbol]: nextHistoryByInterval,
        },
        currentFootprintBySymbol: {
          ...s.currentFootprintBySymbol,
          [symbol]: nextCurrentByInterval,
        },
      };
    });
  },
}));

// ── selectors ────────────────────────────────────────────────────────────────

export const selectRecentTradesBySymbol = (symbol) => (s) =>
  s.recentTradesBySymbol[symbol] ?? EMPTY_ARRAY;
export const selectCvdHistoryBySymbol = (symbol) => (s) =>
  s.cvdHistoryBySymbol[symbol] ?? EMPTY_ARRAY;
export const selectFootprintBySymbol = (symbol) => (s) =>
  s.footprintBySymbol[symbol] ?? null;
export const selectFootprintHistoryBySymbol = (symbol) => (s) =>
  s.footprintHistoryBySymbol[symbol] ?? EMPTY_MAP;
export const selectCurrentFootprintBySymbol = (symbol) => (s) =>
  s.currentFootprintBySymbol[symbol] ?? EMPTY_MAP;
