/**
 * @typedef {Object} OrderBookLevel
 * @property {number} price
 * @property {number} quantity
 * @property {number} total    – running cumulative quantity from best price
 * @property {number} notional – price × quantity
 */

/**
 * @typedef {Object} OrderBook
 * @property {OrderBookLevel[]} bids       – sorted descending (best bid first)
 * @property {OrderBookLevel[]} asks       – sorted ascending (best ask first)
 * @property {number|null}      bestBid
 * @property {number|null}      bestAsk
 * @property {number|null}      spread     – bestAsk - bestBid
 * @property {number|null}      spreadPct  – spread / bestBid * 100
 * @property {number|null}      midPrice   – (bestBid + bestAsk) / 2
 * @property {boolean}          isValidTopOfBook
 * @property {number}           lastUpdateId
 */

/**
 * Processes raw orderbook data (arrays of [price, qty] strings) into enriched,
 * sorted, validated levels with running cumulative totals.
 *
 * Guarantees:
 *   – Only finite, positive prices and quantities pass through.
 *   – Bids are sorted descending (best bid at index 0).
 *   – Asks are sorted ascending  (best ask at index 0).
 *   – Running totals are cumulative quantity (not notional).
 *   – bestBid, bestAsk, spread, midPrice are always consistent.
 *
 * @param {[string, string][]} rawBids
 * @param {[string, string][]} rawAsks
 * @param {number}             lastUpdateId
 * @returns {OrderBook}
 */
export function processOrderBook(rawBids, rawAsks, lastUpdateId = 0) {
  const parseLevel = (level) => {
    const rawPrice = Array.isArray(level) ? level[0] : level.price;
    const rawQty   = Array.isArray(level) ? level[1] : (level.quantity ?? level.qty);
    return { price: parseFloat(rawPrice), quantity: parseFloat(rawQty) };
  };

  const isValidLevel = (lvl) =>
    Number.isFinite(lvl.price)    && lvl.price    > 0 &&
    Number.isFinite(lvl.quantity) && lvl.quantity > 0;

  const buildLevels = (rawLevels, ascending) => {
    const parsed = (rawLevels ?? []).map(parseLevel).filter(isValidLevel);
    parsed.sort((a, b) => ascending ? a.price - b.price : b.price - a.price);
    let running = 0;
    return parsed.map((lvl) => {
      running += lvl.quantity;
      return { price: lvl.price, quantity: lvl.quantity, total: running, notional: lvl.price * lvl.quantity };
    });
  };

  const bids = buildLevels(rawBids, false);
  const asks = buildLevels(rawAsks, true);

  const bestBid = bids.length > 0 ? bids[0].price : null;
  const bestAsk = asks.length > 0 ? asks[0].price : null;

  const spread     = (bestBid !== null && bestAsk !== null) ? bestAsk - bestBid : null;
  const spreadPct  = (spread !== null && bestBid > 0)       ? (spread / bestBid) * 100 : null;
  const midPrice   = (bestBid !== null && bestAsk !== null)  ? (bestBid + bestAsk) / 2  : null;
  const isValidTopOfBook = bestBid !== null && bestAsk !== null && bestAsk > bestBid && spread > 0;

  return { bids, asks, bestBid, bestAsk, spread, spreadPct, midPrice, isValidTopOfBook, lastUpdateId };
}

/**
 * Calculates order book imbalance: (bidVol - askVol) / (bidVol + askVol)
 * Returns a value in [-1, 1], or 0 when data is invalid.
 * @param {OrderBook|null} orderBook
 * @param {number}         depth      – number of levels to consider
 * @returns {number}
 */
export function calcOrderBookImbalance(orderBook, depth = 10) {
  if (!orderBook || !orderBook.isValidTopOfBook) return 0;
  const bids   = orderBook.bids.slice(0, depth);
  const asks   = orderBook.asks.slice(0, depth);
  const bidVol = bids.reduce((s, l) => s + l.quantity, 0);
  const askVol = asks.reduce((s, l) => s + l.quantity, 0);
  const total  = bidVol + askVol;
  if (!total || !Number.isFinite(total)) return 0;
  const result = (bidVol - askVol) / total;
  return Number.isFinite(result) ? result : 0;
}

/**
 * Detects wall levels in a processed OrderBook using the same algorithm as the backend:
 * a level qualifies as a wall when its quantity ≥ multiplier × median(all quantities).
 *
 * Optionally restricts walls to a price band around the mid (maxDistancePct).
 *
 * @param {OrderBook|null} orderBook
 * @param {object}  [opts]
 * @param {number}  [opts.multiplier=5]          – qty multiple over median to classify as wall
 * @param {number|null} [opts.maxDistancePct=null] – if set, only include levels within this fraction of mid
 * @param {number|null} [opts.depth=null]          – cap levels searched per side
 * @returns {{ bidWalls: OrderBookLevel[], askWalls: OrderBookLevel[] }}
 */
export function detectWalls(orderBook, { multiplier = 5, maxDistancePct = null, depth = null } = {}) {
  if (!orderBook || !orderBook.isValidTopOfBook) return { bidWalls: [], askWalls: [] };

  const bids = depth ? orderBook.bids.slice(0, depth) : orderBook.bids;
  const asks = depth ? orderBook.asks.slice(0, depth) : orderBook.asks;

  const allQtys = [...bids, ...asks].map((l) => l.quantity).filter((q) => q > 0);
  if (allQtys.length === 0) return { bidWalls: [], askWalls: [] };

  const sorted = [...allQtys].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const threshold = median * multiplier;

  const midPrice = orderBook.midPrice;
  const isNear = (price) => {
    if (maxDistancePct == null || !midPrice || midPrice <= 0) return true;
    return Math.abs(price - midPrice) / midPrice <= maxDistancePct;
  };

  return {
    bidWalls: bids.filter((l) => l.quantity >= threshold && isNear(l.price)),
    askWalls: asks.filter((l) => l.quantity >= threshold && isNear(l.price)),
  };
}
