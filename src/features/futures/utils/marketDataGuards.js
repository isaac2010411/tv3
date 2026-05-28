/**
 * marketDataGuards.js
 *
 * Utility helpers that shield UI components from invalid, missing, or
 * malformed market data.  Every public function is pure and safe to call
 * with any input including undefined / null / NaN.
 */

// ─── Primitive guards ─────────────────────────────────────────────────────────

/**
 * Returns true only for finite, real numbers (no NaN, no Infinity).
 * @param {*} value
 * @returns {boolean}
 */
export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Coerces a value to a finite number, returning `fallback` on failure.
 * Handles strings, numbers, null and undefined.
 * @param {*}      value
 * @param {number} fallback
 * @returns {number}
 */
export function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Formats a number for display; returns `placeholder` instead of NaN/Infinity/null.
 * @param {*}      value
 * @param {number} decimals
 * @param {string} placeholder
 * @returns {string}
 */
export function safeFormat(value, decimals = 2, placeholder = '—') {
  const n = safeNumber(value, null);
  if (n === null) return placeholder;
  return n.toFixed(decimals);
}

// ─── Order book ───────────────────────────────────────────────────────────────

/**
 * Returns the processed order book if it is structurally valid, otherwise null.
 * Components should treat a null result as "no data yet".
 *
 * Validity rules:
 *   – bids and asks are non-empty arrays
 *   – isValidTopOfBook is true (spread > 0, bestAsk > bestBid)
 *   – bestBid and bestAsk are finite positive numbers
 *
 * @param {Object|null} orderBook
 * @returns {Object|null}
 */
export function sanitizeOrderBook(orderBook) {
  if (!orderBook || typeof orderBook !== 'object') return null;
  if (!Array.isArray(orderBook.bids) || orderBook.bids.length === 0) return null;
  if (!Array.isArray(orderBook.asks) || orderBook.asks.length === 0) return null;
  if (!orderBook.isValidTopOfBook) return null;
  if (!isFiniteNumber(orderBook.bestBid) || orderBook.bestBid <= 0) return null;
  if (!isFiniteNumber(orderBook.bestAsk) || orderBook.bestAsk <= 0) return null;
  return orderBook;
}

/**
 * Filters an order book to levels within `pctRange` percent of the mid price.
 * Returns null if the resulting book is empty or invalid.
 *
 * @param {Object} orderBook  – already processed (from processOrderBook)
 * @param {number} pctRange   – e.g. 0.5 means ±0.5% around mid
 * @returns {Object|null}
 */
export function filterOrderBookByRange(orderBook, pctRange = 0.5) {
  const book = sanitizeOrderBook(orderBook);
  if (!book) return null;
  const mid  = book.midPrice;
  const lo   = mid * (1 - pctRange / 100);
  const hi   = mid * (1 + pctRange / 100);

  const filterLevels = (levels) => {
    let running = 0;
    return levels
      .filter((l) => l.price >= lo && l.price <= hi)
      .map((l) => {
        running += l.quantity;
        return { ...l, total: running };
      });
  };

  const bids = filterLevels(book.bids);
  const asks = filterLevels(book.asks);
  if (!bids.length || !asks.length) return null;

  return { ...book, bids, asks };
}

/**
 * Slices an order book to at most `depth` levels per side, recomputing totals.
 * @param {Object} orderBook
 * @param {number} depth
 * @returns {Object|null}
 */
export function sliceOrderBook(orderBook, depth = 20) {
  const book = sanitizeOrderBook(orderBook);
  if (!book) return null;

  const slice = (levels) => {
    let running = 0;
    return levels.slice(0, depth).map((l) => {
      running += l.quantity;
      return { ...l, total: running };
    });
  };

  return { ...book, bids: slice(book.bids), asks: slice(book.asks) };
}

// ─── Trades ───────────────────────────────────────────────────────────────────

/**
 * Filters a trade array, discarding entries with invalid price or quantity.
 * @param {Array}  trades
 * @returns {Array}
 */
export function sanitizeTrades(trades) {
  if (!Array.isArray(trades)) return [];
  return trades.filter((t) => {
    const price = safeNumber(t?.price ?? t?.p, null);
    const qty   = safeNumber(t?.qty   ?? t?.q, null);
    return price !== null && qty !== null && price > 0 && qty > 0;
  });
}

// ─── Candles ─────────────────────────────────────────────────────────────────

/**
 * Filters a candles array, discarding entries with any invalid OHLC value.
 * @param {Array} candles
 * @returns {Array}
 */
export function sanitizeCandles(candles) {
  if (!Array.isArray(candles)) return [];
  return candles.filter((c) => {
    const o = safeNumber(c?.open  ?? c?.o, null);
    const h = safeNumber(c?.high  ?? c?.h, null);
    const l = safeNumber(c?.low   ?? c?.l, null);
    const cl = safeNumber(c?.close ?? c?.c, null);
    return o !== null && h !== null && l !== null && cl !== null && o > 0;
  });
}

// ─── Footprint ────────────────────────────────────────────────────────────────

/**
 * Validates a footprint candle, discarding levels with invalid volumes.
 * Returns null when the footprint itself is unusable.
 * @param {Object|null} footprint
 * @returns {Object|null}
 */
export function sanitizeFootprint(footprint) {
  if (!footprint || !Array.isArray(footprint.levels)) return null;
  const levels = footprint.levels.filter((lvl) =>
    isFiniteNumber(lvl.price)   && lvl.price   > 0 &&
    isFiniteNumber(lvl.buyVol)  && lvl.buyVol  >= 0 &&
    isFiniteNumber(lvl.sellVol) && lvl.sellVol >= 0
  );
  if (levels.length === 0) return null;
  return { ...footprint, levels };
}

// ─── CVD ──────────────────────────────────────────────────────────────────────

/**
 * Validates a CVD history array, discarding entries missing time or delta.
 * @param {Array} cvdHistory
 * @returns {Array}
 */
export function sanitizeCvdHistory(cvdHistory) {
  if (!Array.isArray(cvdHistory)) return [];
  return cvdHistory.filter((pt) => {
    const delta = safeNumber(pt?.delta, null);
    const timeValue = pt?.time ?? pt?.timestamp ?? pt?.ts ?? null;
    const numericTime = safeNumber(timeValue, null);
    const parsedTime = typeof timeValue === 'string' ? Date.parse(timeValue) : null;
    return delta !== null && (numericTime !== null || Number.isFinite(parsedTime));
  });
}
