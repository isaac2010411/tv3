/**
 * portfolioStore
 *
 * Account-level state: open positions, open orders, and account balance.
 * This data arrives infrequently (initial snapshot + REST refresh) so it
 * sits in its own store to keep market-data writes from triggering re-renders
 * in position/order panels.
 */
import { create } from 'zustand';

export const EMPTY_ARRAY = Object.freeze([]);

export const usePortfolioStore = create((set) => ({
  /** { [symbol]: PositionObject[] } */
  positionsBySymbol: {},

  /** { [symbol]: OpenOrderObject[] } */
  openOrdersBySymbol: {},

  /** { [symbol]: number | null } – account balance relevant to symbol */
  balanceBySymbol: {},

  // ── account-level (Portfolio Manager) ──────────────────────────────────────
  /** Latest account snapshot { positions, exposureBySymbol, totalNotional, realizedPnl, ... } */
  accountSnapshot: null,
  /** Exposure breakdown { totalNotional, exposureBySymbol } */
  exposure: null,
  /** Performance stats { realizedPnlByDay, totalRealizedPnl, ... } */
  performance: null,

  // ── actions ───────────────────────────────────────────────────────────────

  resetSymbol(symbol) {
    if (!symbol) return;
    set((s) => ({
      positionsBySymbol:  { ...s.positionsBySymbol,  [symbol]: [] },
      openOrdersBySymbol: { ...s.openOrdersBySymbol, [symbol]: [] },
      balanceBySymbol:    { ...s.balanceBySymbol,    [symbol]: null },
    }));
  },

  /** Phase 5.5 — fully evict symbol slots */
  cleanupSymbol(symbol) {
    if (!symbol) return;
    set((s) => {
      const p = { ...s.positionsBySymbol };  delete p[symbol];
      const o = { ...s.openOrdersBySymbol }; delete o[symbol];
      const b = { ...s.balanceBySymbol };    delete b[symbol];
      return { positionsBySymbol: p, openOrdersBySymbol: o, balanceBySymbol: b };
    });
  },

  setPositions(symbol, positions) {
    if (!symbol) return;
    set((s) => ({
      positionsBySymbol: {
        ...s.positionsBySymbol,
        [symbol]: Array.isArray(positions) ? positions : [],
      },
    }));
  },

  setOpenOrders(symbol, orders) {
    if (!symbol) return;
    set((s) => ({
      openOrdersBySymbol: {
        ...s.openOrdersBySymbol,
        [symbol]: Array.isArray(orders) ? orders : [],
      },
    }));
  },

  setBalance(symbol, balance) {
    if (!symbol) return;
    set((s) => ({
      balanceBySymbol: { ...s.balanceBySymbol, [symbol]: balance ?? null },
    }));
  },

  // ── account-level actions ────────────────────────────────────────────────
  applySnapshot(snapshot) {
    set({ accountSnapshot: snapshot || null })
  },

  setExposure(exposure) {
    set({ exposure: exposure || null })
  },

  setPerformance(performance) {
    set({ performance: performance || null })
  },
}));

// ── selectors ────────────────────────────────────────────────────────────────

export const selectPositionsBySymbol = (symbol) => (s) =>
  s.positionsBySymbol[symbol] ?? EMPTY_ARRAY;
export const selectOpenOrdersBySymbol = (symbol) => (s) =>
  s.openOrdersBySymbol[symbol] ?? EMPTY_ARRAY;
export const selectBalanceBySymbol = (symbol) => (s) =>
  s.balanceBySymbol[symbol] ?? null;

export const selectAccountSnapshot = (s) => s.accountSnapshot;
export const selectExposure = (s) => s.exposure;
export const selectPerformance = (s) => s.performance;
