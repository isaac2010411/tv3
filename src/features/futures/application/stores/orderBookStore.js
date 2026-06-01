/**
 * orderBookStore
 *
 * Holds processed OrderBook snapshots (DOM top-N) and full local-book
 * reconstructions per symbol.  Updates at ~20 Hz from the server but never
 * triggers renders in CVD / Trade panels.
 */
import { create } from 'zustand';

const STORE_LOCAL_BOOK = String(process.env.REACT_APP_STORE_LOCAL_BOOK || '').toLowerCase() === 'true';
const MAX_RETAINED_LEVELS = Number(process.env.REACT_APP_MAX_RETAINED_BOOK_LEVELS || 60);
const MAX_RETAINED_HEATMAP_LEVELS = Number(process.env.REACT_APP_MAX_RETAINED_HEATMAP_LEVELS || 40);
const MAX_RETAINED_WALLS = Number(process.env.REACT_APP_MAX_RETAINED_BOOK_WALLS || 12);

function trimList(list, max) {
  return Array.isArray(list) ? list.slice(0, max) : list;
}

function compactBookMetrics(bookMetrics) {
  if (!bookMetrics || typeof bookMetrics !== 'object') return bookMetrics ?? null;
  return {
    ...bookMetrics,
    bidWalls: trimList(bookMetrics.bidWalls, MAX_RETAINED_WALLS),
    askWalls: trimList(bookMetrics.askWalls, MAX_RETAINED_WALLS),
    heatmapSnapshot: bookMetrics.heatmapSnapshot
      ? {
          ...bookMetrics.heatmapSnapshot,
          bids: trimList(bookMetrics.heatmapSnapshot.bids, MAX_RETAINED_HEATMAP_LEVELS),
          asks: trimList(bookMetrics.heatmapSnapshot.asks, MAX_RETAINED_HEATMAP_LEVELS),
        }
      : bookMetrics.heatmapSnapshot,
  };
}

function compactBook(book) {
  if (!book || typeof book !== 'object') return book ?? null;
  return {
    ...book,
    bids: trimList(book.bids, MAX_RETAINED_LEVELS),
    asks: trimList(book.asks, MAX_RETAINED_LEVELS),
    bookMetrics: compactBookMetrics(book.bookMetrics),
  };
}

export const useOrderBookStore = create((set) => ({
  /** { [symbol]: ProcessedOrderBook | null } */
  orderBookBySymbol: {},

  /** { [symbol]: ProcessedOrderBook | null } – full local reconstruction */
  localBookBySymbol: {},

  /** { [symbol]: TopOfBook | null } */
  topOfBookBySymbol: {},

  /** { [symbol]: BackendBookMetrics | null } */
  bookMetricsBySymbol: {},

  // ── actions ───────────────────────────────────────────────────────────────

  resetSymbol(symbol) {
    if (!symbol) return;
    set((s) => ({
      orderBookBySymbol: { ...s.orderBookBySymbol, [symbol]: null },
      localBookBySymbol: { ...s.localBookBySymbol, [symbol]: null },
      topOfBookBySymbol: { ...s.topOfBookBySymbol, [symbol]: null },
      bookMetricsBySymbol: { ...s.bookMetricsBySymbol, [symbol]: null },
    }));
  },

  /**
   * Phase 5.5 — fully evict a symbol from the store. Use when the user
   * navigates away to release retained memory (delete vs. zeroing the slot).
   */
  cleanupSymbol(symbol) {
    if (!symbol) return;
    set((s) => {
      const ob = { ...s.orderBookBySymbol };       delete ob[symbol];
      const lb = { ...s.localBookBySymbol };       delete lb[symbol];
      const tb = { ...s.topOfBookBySymbol };       delete tb[symbol];
      const bm = { ...s.bookMetricsBySymbol };     delete bm[symbol];
      return { orderBookBySymbol: ob, localBookBySymbol: lb, topOfBookBySymbol: tb, bookMetricsBySymbol: bm };
    });
  },

  setOrderBook(symbol, orderBook, topOfBook) {
    if (!symbol) return;
    const compacted = compactBook(orderBook);
    set((s) => ({
      orderBookBySymbol: { ...s.orderBookBySymbol, [symbol]: compacted },
      topOfBookBySymbol: { ...s.topOfBookBySymbol, [symbol]: topOfBook ?? s.topOfBookBySymbol[symbol] },
    }));
  },

  setLocalBook(symbol, localBook) {
    if (!symbol) return;
    const compacted = compactBook(localBook);
    const nextMetrics = compacted?.bookMetrics ?? null;
    set((s) => ({
      localBookBySymbol: STORE_LOCAL_BOOK
        ? { ...s.localBookBySymbol, [symbol]: compacted }
        : s.localBookBySymbol,
      bookMetricsBySymbol: {
        ...s.bookMetricsBySymbol,
        [symbol]: nextMetrics ?? s.bookMetricsBySymbol[symbol] ?? null,
      },
    }));
  },

  setBookMetrics(symbol, bookMetrics) {
    if (!symbol) return;
    const compacted = compactBookMetrics(bookMetrics);
    set((s) => ({
      bookMetricsBySymbol: { ...s.bookMetricsBySymbol, [symbol]: compacted },
    }));
  },
}));

// ── selectors ────────────────────────────────────────────────────────────────

export const selectOrderBookBySymbol = (symbol) => (s) => s.orderBookBySymbol[symbol] ?? null;
export const selectLocalBookBySymbol = (symbol) => (s) => s.localBookBySymbol[symbol] ?? null;
export const selectTopOfBookBySymbol = (symbol) => (s) => s.topOfBookBySymbol[symbol] ?? null;
export const selectBookMetricsBySymbol = (symbol) => (s) => s.bookMetricsBySymbol[symbol] ?? null;
