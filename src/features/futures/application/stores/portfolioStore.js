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

function safeNumber(value, fallback = null) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function positionSize(position) {
  return safeNumber(
    position?.positionAmt ??
      position?.quantity ??
      position?.qty ??
      position?.size ??
      position?.contracts,
    0,
  )
}

export function getOpenLivePositions(positions) {
  if (!Array.isArray(positions)) return []
  return positions.filter((position) => Math.abs(positionSize(position)) > 0)
}

export function extractLivePositions(snapshot) {
  return getOpenLivePositions(
    snapshot?.account?.positions ??
      snapshot?.live?.positions ??
      snapshot?.futures?.positions ??
      [],
  )
}

export function extractLiveBalance(payload) {
  if (payload == null) return null
  if (typeof payload === 'number' || typeof payload === 'string') return safeNumber(payload)

  return safeNumber(
    payload.availableBalance ??
      payload.balance ??
      payload.usdtBalance ??
      payload.initialBalance ??
      payload.walletBalance ??
      payload.account?.availableBalance ??
      payload.account?.balance ??
      payload.account?.usdtBalance ??
      payload.live?.availableBalance ??
      payload.live?.balance ??
      payload.futures?.availableBalance ??
      payload.futures?.balance ??
      payload.asset?.availableBalance,
  )
}

function normalizeAccountSnapshot(snapshot, liveBalance) {
  if (!snapshot || typeof snapshot !== 'object') {
    return liveBalance == null ? null : { positions: [], availableBalance: liveBalance }
  }

  const positions = extractLivePositions(snapshot)
  const availableBalance = extractLiveBalance(snapshot) ?? liveBalance
  return {
    ...snapshot,
    positions,
    availableBalance,
    live: {
      ...(snapshot.live ?? {}),
      positions,
      availableBalance,
    },
  }
}

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
  /** USDT available balance from Binance futures account */
  liveBalance: null,

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
    set((s) => {
      const liveBalance = extractLiveBalance(snapshot) ?? s.liveBalance
      return {
        liveBalance,
        accountSnapshot: normalizeAccountSnapshot(snapshot, liveBalance),
      }
    })
  },

  setLiveBalance(balance) {
    set((s) => {
      const liveBalance = extractLiveBalance(balance)
      return {
        liveBalance,
        accountSnapshot: normalizeAccountSnapshot(s.accountSnapshot, liveBalance),
      }
    })
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
export const selectLiveBalance = (s) => s.liveBalance;
