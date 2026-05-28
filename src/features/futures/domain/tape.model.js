/**
 * Domain model: Tape Reader
 *
 * Enriches raw trade events from `futures:asset:trades` for
 * display in the TapeReaderPanel component.
 */

/**
 * @typedef {'large'|'medium'|'small'} SizeClass
 *
 * @typedef {Object} TapeEntry
 * @property {number}    time
 * @property {string}    timeStr       formatted HH:MM:SS
 * @property {'buy'|'sell'} side
 * @property {number}    price
 * @property {number}    qty
 * @property {SizeClass} sizeClass
 * @property {boolean}   isBuyerMaker
 */

/**
 * Format a Unix-ms timestamp to HH:MM:SS.
 * @param {number} ms
 * @returns {string}
 */
export function formatTime(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Classify a trade's quantity relative to recent trade history.
 *
 * large  → qty ≥ mean + 2 × stddev  (top ~2.5% of trades by size)
 * medium → qty ≥ mean + 0.5 × stddev
 * small  → everything else
 *
 * Falls back to 'medium' when there is insufficient history.
 *
 * @param {number}   qty
 * @param {number[]} recentQtys  array of recent qty values (last N trades)
 * @returns {SizeClass}
 */
export function classifySize(qty, recentQtys) {
  if (!recentQtys || recentQtys.length < 5) return 'medium';

  const n    = recentQtys.length;
  const mean = recentQtys.reduce((a, b) => a + b, 0) / n;
  const variance = recentQtys.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const std  = Math.sqrt(variance);

  if (qty >= mean + 2 * std)   return 'large';
  if (qty >= mean + 0.5 * std) return 'medium';
  return 'small';
}

/**
 * Convert a raw trade event to an enriched TapeEntry.
 *
 * @param {{ price: string|number, qty: string|number, isBuyerMaker: boolean, time: number }} trade
 * @param {number[]} recentQtys  recent qty values for size classification
 * @returns {TapeEntry}
 */
export function formatTrade(trade, recentQtys = []) {
  const price = parseFloat(trade.price);
  const qty   = parseFloat(trade.qty ?? trade.quantity ?? 0);
  const time  = trade.time ?? Date.now();

  return {
    time,
    timeStr:     formatTime(time),
    side:        trade.isBuyerMaker ? 'sell' : 'buy',
    price,
    qty,
    sizeClass:   classifySize(qty, recentQtys),
    isBuyerMaker: trade.isBuyerMaker,
  };
}
