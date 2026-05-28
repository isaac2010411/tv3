/**
 * Client-side technical indicator helpers.
 * Pure functions — no side-effects, no imports.
 *
 * Logic mirrors MarketContextEvaluator.js on the backend (single source of truth
 * for math), but operates on already-fetched candle arrays.
 */

/**
 * Full EMA series aligned to `closes` (one value per candle after warmup).
 * The returned array is shorter than closes by (period - 1) items (warmup gap).
 * To overlay on the chart, align the last N candles with the last N series values.
 *
 * @param {number[]} closes
 * @param {number}   period
 * @returns {number[]}
 */
export function computeEMASeries(closes, period) {
  if (!closes || closes.length < period) return [];
  const k = 2 / (period + 1);
  const series = [];
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  series.push(ema);
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    series.push(ema);
  }
  return series;
}

/**
 * Full RSI series. Returns one value per candle after the initial warmup period.
 * Length = closes.length - period.
 *
 * @param {number[]} closes
 * @param {number}   [period=14]
 * @returns {number[]}
 */
export function computeRSISeries(closes, period = 14) {
  if (!closes || closes.length < period + 1) return [];

  const series = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const rsi0 = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  series.push(rsi0);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, diff)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period;
    series.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }

  return series;
}

/**
 * Full MACD histogram series aligned to candles.
 * Returns { macdLine, signalLine, histogram } — each an array of the same length.
 * The offset from the start of `closes` is (slow + signalPeriod - 2) candles.
 *
 * @param {number[]} closes
 * @param {number}   [fast=12]
 * @param {number}   [slow=26]
 * @param {number}   [signalPeriod=9]
 * @returns {{ macdLine: number[], signalLine: number[], histogram: number[], startIndex: number }}
 */
export function computeMACDSeries(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const empty = { macdLine: [], signalLine: [], histogram: [], startIndex: 0 };
  if (!closes || closes.length < slow + signalPeriod) return empty;

  const fastSeries = computeEMASeries(closes, fast);
  const slowSeries = computeEMASeries(closes, slow);
  if (!fastSeries.length || !slowSeries.length) return empty;

  // fast series starts at index (fast-1), slow series starts at index (slow-1)
  // align them: slowSeries[i] corresponds to closes[slow - 1 + i]
  // fastSeries[i] corresponds to closes[fast - 1 + i]
  // For slow candle index j: fast index = j - (slow - fast)
  const offset = slow - fast;
  const macdLine = slowSeries.map((s, i) => fastSeries[i + offset] - s);

  const sigSeries = computeEMASeries(macdLine, signalPeriod);
  if (!sigSeries.length) return empty;

  // sigSeries[i] aligns with macdLine[signalPeriod - 1 + i]
  const sigOffset = signalPeriod - 1;
  const histogram = sigSeries.map((sig, i) => macdLine[sigOffset + i] - sig);

  // startIndex: the candle index in the original closes[] where histogram[0] lives
  // macdLine[0] lives at closes index (slow - 1)
  // macdLine[sigOffset] lives at closes index (slow - 1 + sigOffset)
  const startIndex = slow - 1 + sigOffset;

  return { macdLine: macdLine.slice(sigOffset), signalLine: sigSeries, histogram, startIndex };
}
