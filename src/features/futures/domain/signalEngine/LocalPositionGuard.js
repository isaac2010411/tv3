/**
 * Local Position Guard
 *
 * Manages a local (non-exchange) position state for testing the signal engine
 * without executing real orders.
 *
 * This module exports pure factory functions that create and transform
 * position objects. All state is held externally (in the hook or engine).
 */

// ─── Position Factory ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} LocalPosition
 * @property {string}         id              – unique position id
 * @property {string}         symbol          – trading symbol
 * @property {'LONG'|'SHORT'} direction       – position direction
 * @property {number}         entryPrice      – price at position open
 * @property {number|null}    stopLoss        – stop loss price
 * @property {number|null}    takeProfit      – take profit price
 * @property {number}         openedAt        – timestamp (ms)
 * @property {string|null}    sourceSignalId  – id of the signal that opened this position
 * @property {'OPEN'|'CLOSED'} status         – position lifecycle status
 */

/**
 * Creates a new local position.
 *
 * @param {Object} params
 * @param {string}           params.symbol
 * @param {'LONG'|'SHORT'}   params.direction
 * @param {number}           params.entryPrice
 * @param {number|null}      [params.stopLoss]
 * @param {number|null}      [params.takeProfit]
 * @param {string|null}      [params.sourceSignalId]
 * @returns {LocalPosition}
 */
export function createLocalPosition({ symbol, direction, entryPrice, stopLoss = null, takeProfit = null, sourceSignalId = null }) {
  return {
    id:            `pos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    symbol,
    direction,
    entryPrice,
    stopLoss,
    takeProfit,
    openedAt:      Date.now(),
    sourceSignalId,
    status:        'OPEN',
  };
}

/**
 * Returns null (represents no open position).
 * @returns {null}
 */
export function createEmptyPosition() {
  return null;
}

// ─── Position Queries ─────────────────────────────────────────────────────────

/**
 * Returns true if a local position is currently open.
 * @param {LocalPosition|null} position
 * @returns {boolean}
 */
export function hasOpenPosition(position) {
  return position !== null && position !== undefined && position.status === 'OPEN';
}

/**
 * Marks a local position as closed (returns a new object — does not mutate).
 * @param {LocalPosition} position
 * @returns {LocalPosition}
 */
export function closeLocalPosition(position) {
  return { ...position, status: 'CLOSED' };
}

/**
 * Returns the direction of the open position, or null if none.
 * @param {LocalPosition|null} position
 * @returns {'LONG'|'SHORT'|null}
 */
export function getPositionDirection(position) {
  return position?.direction ?? null;
}

/**
 * Calculates the unrealized PnL for a local position given the current price.
 * Returns null if no position is open or price is unavailable.
 *
 * @param {LocalPosition|null} position
 * @param {number|null}        currentPrice
 * @returns {{ pnl: number, pnlPct: number }|null}
 */
export function calcUnrealizedPnL(position, currentPrice) {
  if (!position || currentPrice == null || !Number.isFinite(currentPrice)) return null;

  const diff = position.direction === 'LONG'
    ? currentPrice - position.entryPrice
    : position.entryPrice - currentPrice;

  const pnlPct = position.entryPrice > 0
    ? (diff / position.entryPrice) * 100
    : 0;

  return { pnl: diff, pnlPct };
}
