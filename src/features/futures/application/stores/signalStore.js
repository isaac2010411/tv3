/**
 * signalStore
 *
 * Microstructure signals: backend engine updates, liquidity-shift events,
 * and spoofing candidates.  Deduplicated at write time so rapid identical
 * events never cause spurious renders in the ribbon or spoofing panels.
 */
import { create } from 'zustand';

export const EMPTY_ARRAY = Object.freeze([]);

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
  ]
    .filter((v) => v !== undefined && v !== null)
    .join('|');
}

function shouldAcceptEvent(cache, symbol, event, minMs = MIN_LIQUIDITY_EVENT_MS) {
  const now = Date.now();
  const key = eventKey(event);
  const previous = cache.get(symbol);
  if (previous && previous.key === key) return false;
  if (previous && now - previous.time < minMs) return false;
  cache.set(symbol, { key, time: now });
  return true;
}

export const useSignalStore = create((set) => ({
  /** { [symbol]: SignalUpdate | null } */
  signalUpdateBySymbol: {},

  /** { [symbol]: LiquidityShiftEvent[] } */
  liquidityShiftsBySymbol: {},

  /** { [symbol]: SpoofingCandidateEvent[] } */
  spoofingCandidatesBySymbol: {},

  /** { [symbol]: DecisionTape | null } */
  decisionTapeBySymbol: {},

  // ── actions ───────────────────────────────────────────────────────────────

  resetSymbol(symbol) {
    if (!symbol) return;
    lastLiquidityEventBySymbol.delete(symbol);
    lastSpoofingEventBySymbol.delete(symbol);
    set((s) => ({
      signalUpdateBySymbol:        { ...s.signalUpdateBySymbol,        [symbol]: null },
      liquidityShiftsBySymbol:     { ...s.liquidityShiftsBySymbol,     [symbol]: [] },
      spoofingCandidatesBySymbol:  { ...s.spoofingCandidatesBySymbol,  [symbol]: [] },
      decisionTapeBySymbol:        { ...s.decisionTapeBySymbol,        [symbol]: null },
    }));
  },

  /** Phase 5.5 — fully evict symbol slots */
  cleanupSymbol(symbol) {
    if (!symbol) return;
    lastLiquidityEventBySymbol.delete(symbol);
    lastSpoofingEventBySymbol.delete(symbol);
    set((s) => {
      const u = { ...s.signalUpdateBySymbol };       delete u[symbol];
      const l = { ...s.liquidityShiftsBySymbol };    delete l[symbol];
      const sp = { ...s.spoofingCandidatesBySymbol }; delete sp[symbol];
      const dt = { ...s.decisionTapeBySymbol };      delete dt[symbol];
      return { signalUpdateBySymbol: u, liquidityShiftsBySymbol: l, spoofingCandidatesBySymbol: sp, decisionTapeBySymbol: dt };
    });
  },

  setSignalUpdate(symbol, update) {
    if (!symbol) return;
    set((s) => ({
      signalUpdateBySymbol: { ...s.signalUpdateBySymbol, [symbol]: update },
    }));
  },

  prependLiquidityShift(symbol, event, maxLength = 100) {
    if (!symbol || !event) return;
    if (!shouldAcceptEvent(lastLiquidityEventBySymbol, symbol, event)) return;
    set((s) => {
      const prev = s.liquidityShiftsBySymbol[symbol] ?? EMPTY_ARRAY;
      return {
        liquidityShiftsBySymbol: {
          ...s.liquidityShiftsBySymbol,
          [symbol]: [event, ...prev].slice(0, maxLength),
        },
      };
    });
  },

  prependSpoofingCandidate(symbol, event, maxLength = 50) {
    if (!symbol || !event) return;
    if (!shouldAcceptEvent(lastSpoofingEventBySymbol, symbol, event, 500)) return;
    set((s) => {
      const prev = s.spoofingCandidatesBySymbol[symbol] ?? EMPTY_ARRAY;
      return {
        spoofingCandidatesBySymbol: {
          ...s.spoofingCandidatesBySymbol,
          [symbol]: [event, ...prev].slice(0, maxLength),
        },
      };
    });
  },

  setDecisionTape(symbol, decisionTape) {
    if (!symbol) return;
    set((s) => ({
      decisionTapeBySymbol: { ...s.decisionTapeBySymbol, [symbol]: decisionTape },
    }));
  },
}));

// ── selectors ────────────────────────────────────────────────────────────────

export const selectSignalUpdateBySymbol = (symbol) => (s) =>
  s.signalUpdateBySymbol[symbol] ?? null;
export const selectLiquidityShiftsBySymbol = (symbol) => (s) =>
  s.liquidityShiftsBySymbol[symbol] ?? EMPTY_ARRAY;
export const selectSpoofingCandidatesBySymbol = (symbol) => (s) =>
  s.spoofingCandidatesBySymbol[symbol] ?? EMPTY_ARRAY;
export const selectDecisionTapeBySymbol = (symbol) => (s) =>
  s.decisionTapeBySymbol[symbol] ?? null;
