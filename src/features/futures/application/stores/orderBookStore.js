/**
 * orderBookStore
 *
 * Holds processed OrderBook snapshots (DOM top-N) and full local-book
 * reconstructions per symbol.  Updates at ~20 Hz from the server but never
 * triggers renders in CVD / Trade panels.
 */
import { create } from 'zustand';

export const useOrderBookStore = create((set) => ({
  /** { [symbol]: ProcessedOrderBook | null } */
  orderBookBySymbol: {},

  /** { [symbol]: ProcessedOrderBook | null } – full local reconstruction */
  localBookBySymbol: {},

  /** { [symbol]: TopOfBook | null } */
  topOfBookBySymbol: {},

  // ── actions ───────────────────────────────────────────────────────────────

  resetSymbol(symbol) {
    if (!symbol) return;
    set((s) => ({
      orderBookBySymbol: { ...s.orderBookBySymbol, [symbol]: null },
      localBookBySymbol: { ...s.localBookBySymbol, [symbol]: null },
      topOfBookBySymbol: { ...s.topOfBookBySymbol, [symbol]: null },
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
      return { orderBookBySymbol: ob, localBookBySymbol: lb, topOfBookBySymbol: tb };
    });
  },

  setOrderBook(symbol, orderBook, topOfBook) {
    if (!symbol) return;
    set((s) => ({
      orderBookBySymbol: { ...s.orderBookBySymbol, [symbol]: orderBook },
      topOfBookBySymbol: { ...s.topOfBookBySymbol, [symbol]: topOfBook ?? s.topOfBookBySymbol[symbol] },
    }));
  },

  setLocalBook(symbol, localBook) {
    if (!symbol) return;
    set((s) => ({
      localBookBySymbol: { ...s.localBookBySymbol, [symbol]: localBook },
    }));
  },
}));

// ── selectors ────────────────────────────────────────────────────────────────

export const selectOrderBookBySymbol = (symbol) => (s) => s.orderBookBySymbol[symbol] ?? null;
export const selectLocalBookBySymbol = (symbol) => (s) => s.localBookBySymbol[symbol] ?? null;
export const selectTopOfBookBySymbol = (symbol) => (s) => s.topOfBookBySymbol[symbol] ?? null;
