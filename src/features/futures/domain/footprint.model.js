/**
 * Domain model: Footprint Candle
 *
 * Processes footprint candle payloads received from the server
 * (futures:asset:footprint and futures:asset:footprint:init events)
 * into display-ready structures for the FootprintCandleD3 component.
 */

/**
 * @typedef {Object} FootprintLevel
 * @property {number} price
 * @property {number} buyVol
 * @property {number} sellVol
 * @property {number} total
 * @property {number} delta       buyVol - sellVol
 * @property {number} imbalance   (buyVol - sellVol) / total, in [-1, 1]
 * @property {boolean} isPoc      true if this is the Point of Control
 */

/**
 * @typedef {Object} FootprintDisplay
 * @property {string}           symbol
 * @property {string}           interval
 * @property {number}           openTime
 * @property {number|null}      open
 * @property {number|null}      high
 * @property {number|null}      low
 * @property {number|null}      close
 * @property {number}           volume
 * @property {boolean}          isFinal
 * @property {FootprintLevel[]} levels   sorted ascending by price
 * @property {number|null}      poc      Point of Control price
 * @property {number}           totalDelta  sum of all level deltas
 */

/**
 * Convert a raw footprint candle (server payload) into a display object.
 * @param {object} raw  Plain object from `footprint.toPlainObject()` on the server
 * @returns {FootprintDisplay}
 */
export function buildFootprintDisplay(raw) {
  if (!raw) return null;

  let pocPrice   = null;
  let pocVolume  = -Infinity;
  let totalDelta = 0;

  const levels = (raw.levels ?? []).map((l) => {
    const buyVol  = parseFloat(l.buyVol)  || 0;
    const sellVol = parseFloat(l.sellVol) || 0;
    const total   = buyVol + sellVol;
    const delta   = buyVol - sellVol;
    const imbal   = total > 0 ? delta / total : 0;

    totalDelta += delta;

    if (total > pocVolume) {
      pocVolume = total;
      pocPrice  = parseFloat(l.price);
    }

    return {
      price:     parseFloat(l.price),
      buyVol,
      sellVol,
      total,
      delta,
      imbalance: imbal,
      isPoc:     false,   // will be set below
    };
  });

  // Mark POC
  for (const lvl of levels) {
    lvl.isPoc = lvl.price === pocPrice;
  }

  return {
    symbol:     raw.symbol,
    interval:   raw.interval,
    openTime:   raw.openTime,
    open:       raw.open  != null ? parseFloat(raw.open)  : null,
    high:       raw.high  != null ? parseFloat(raw.high)  : null,
    low:        raw.low   != null ? parseFloat(raw.low)   : null,
    close:      raw.close != null ? parseFloat(raw.close) : null,
    volume:     parseFloat(raw.volume) || 0,
    isFinal:    raw.isFinal ?? false,
    levels,
    poc:        pocPrice,
    totalDelta,
  };
}

/**
 * Returns the price of the Point of Control (level with highest total volume).
 * @param {FootprintDisplay} fp
 * @returns {number|null}
 */
export function getPoc(fp) {
  return fp?.poc ?? null;
}

/**
 * Upsert a footprint candle into a history array (keyed by openTime).
 * If a candle with the same openTime already exists it is replaced; otherwise
 * appended. Returns a new array (immutable update).
 *
 * @param {FootprintDisplay[]} history
 * @param {FootprintDisplay}   candle
 * @param {number}             [maxItems]  cap on history length (default 200)
 * @returns {FootprintDisplay[]}
 */
export function upsertFootprint(history, candle, maxItems = 200) {
  const idx = history.findIndex((c) => c.openTime === candle.openTime);
  let updated;
  if (idx >= 0) {
    updated = [...history];
    updated[idx] = candle;
  } else {
    updated = [...history, candle];
    if (updated.length > maxItems) updated = updated.slice(-maxItems);
  }
  return updated;
}
