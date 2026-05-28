/**
 * Domain model: Cumulative Volume Delta (CVD)
 *
 * Processes the stream of CVD updates from the server
 * (futures:asset:cvd events) into display-ready structures.
 *
 * CVD = running sum of (buy aggressor volume − sell aggressor volume).
 * A rising CVD line → net buying pressure.
 * A falling CVD line → net selling pressure.
 */

/**
 * @typedef {Object} CvdPoint
 * @property {number} time    Unix ms
 * @property {number} cvd     Running CVD value at this point
 * @property {number} delta   Individual trade delta (+qty or -qty)
 * @property {string} price   Trade price
 * @property {'buy'|'sell'} side
 */

/**
 * Append a new CVD event to the history array.
 * Returns a new array capped at maxItems (immutable update).
 *
 * @param {CvdPoint[]} history
 * @param {{ cvd: string, delta: string, price: string, side: string, time: number }} event
 * @param {number} [maxItems]
 * @returns {CvdPoint[]}
 */
export function appendCvdPoint(history, event, maxItems = 500) {
  const timeValue = event?._meta?.exchangeEventTime ?? event.time ?? event.timestamp ?? event.ts ?? Date.now();
  const parsedTime = typeof timeValue === 'string' ? Date.parse(timeValue) : Number(timeValue);
  const point = {
    time:  Number.isFinite(parsedTime) ? parsedTime : Date.now(),
    cvd:   parseFloat(event.cvd)   || 0,
    delta: parseFloat(event.delta) || 0,
    price: event.price,
    side:  event.side,
    _meta: event?._meta ?? null,
  };

  const updated = [...history, point].sort((a, b) => a.time - b.time);
  return updated.length > maxItems ? updated.slice(-maxItems) : updated;
}

/**
 * Aggregate CVD history into per-second (or per-N-trades) bars for bar-chart rendering.
 * Groups consecutive points into bars by the given interval (ms).
 *
 * @param {CvdPoint[]} history
 * @param {number}     intervalMs  bar width in ms (default 1000 = 1-second bars)
 * @returns {Array<{ time: number, open: number, close: number, high: number, low: number, delta: number }>}
 */
export function buildCvdBars(history, intervalMs = 1000) {
  if (!history || history.length === 0) return [];

  const bars = [];
  let barStart = null;
  let barOpen  = null;
  let barHigh  = -Infinity;
  let barLow   = Infinity;
  let barClose = null;
  let barDelta = 0;

  for (const pt of history) {
    const bucket = Math.floor(pt.time / intervalMs) * intervalMs;

    if (barStart === null || bucket !== barStart) {
      if (barStart !== null) {
        bars.push({ time: barStart, open: barOpen, high: barHigh, low: barLow, close: barClose, delta: barDelta });
      }
      barStart = bucket;
      barOpen  = pt.cvd;
      barHigh  = pt.cvd;
      barLow   = pt.cvd;
      barClose = pt.cvd;
      barDelta = pt.delta;
    } else {
      if (pt.cvd > barHigh) barHigh = pt.cvd;
      if (pt.cvd < barLow)  barLow  = pt.cvd;
      barClose  = pt.cvd;
      barDelta += pt.delta;
    }
  }

  if (barStart !== null) {
    bars.push({ time: barStart, open: barOpen, high: barHigh, low: barLow, close: barClose, delta: barDelta });
  }

  return bars;
}

/**
 * Simple bullish CVD divergence detection:
 * price made a lower low but CVD made a higher low → hidden buying pressure.
 *
 * @param {CvdPoint[]} history
 * @param {number}     lookback  number of recent points to consider (default 50)
 * @returns {boolean}
 */
export function isBullishDivergence(history, lookback = 50) {
  const slice = history.slice(-lookback);
  if (slice.length < lookback) return false;

  const firstHalf  = slice.slice(0, Math.floor(lookback / 2));
  const secondHalf = slice.slice(Math.floor(lookback / 2));

  const priceMin1 = Math.min(...firstHalf.map((p)  => parseFloat(p.price)));
  const priceMin2 = Math.min(...secondHalf.map((p) => parseFloat(p.price)));
  const cvdMin1   = Math.min(...firstHalf.map((p)  => p.cvd));
  const cvdMin2   = Math.min(...secondHalf.map((p) => p.cvd));

  return priceMin2 < priceMin1 && cvdMin2 > cvdMin1;
}

/**
 * Simple bearish CVD divergence detection:
 * price made a higher high but CVD made a lower high → hidden selling pressure.
 *
 * @param {CvdPoint[]} history
 * @param {number}     lookback
 * @returns {boolean}
 */
export function isBearishDivergence(history, lookback = 50) {
  const slice = history.slice(-lookback);
  if (slice.length < lookback) return false;

  const firstHalf  = slice.slice(0, Math.floor(lookback / 2));
  const secondHalf = slice.slice(Math.floor(lookback / 2));

  const priceMax1 = Math.max(...firstHalf.map((p)  => parseFloat(p.price)));
  const priceMax2 = Math.max(...secondHalf.map((p) => parseFloat(p.price)));
  const cvdMax1   = Math.max(...firstHalf.map((p)  => p.cvd));
  const cvdMax2   = Math.max(...secondHalf.map((p) => p.cvd));

  return priceMax2 > priceMax1 && cvdMax2 < cvdMax1;
}
