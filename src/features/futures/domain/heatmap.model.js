/**
 * Domain model: Liquidity Heatmap
 *
 * Builds a 2-D matrix from a rolling array of orderbook snapshots for
 * rendering a Bookmap-style heatmap (time × price, color = volume).
 *
 * Each snapshot is expected to be the raw payload from `futures:asset:orderbook`:
 *   { bids: [{price, quantity}|[price,qty]...], asks: [...] }
 *
 * Time axis  → snapshot index (0 = oldest, N-1 = newest)
 * Price axis → buckets of size `priceBucketSize` covering the visible range
 */

/**
 * Round a price down to the nearest bucket boundary.
 * @param {number} price
 * @param {number} bucketSize
 * @returns {number}
 */
export function priceBucket(price, bucketSize) {
  return Math.floor(price / bucketSize) * bucketSize;
}

/**
 * Extract the min/max price visible across all snapshots with optional padding.
 * @param {Array<{bids: any[], asks: any[]}>} snapshots
 * @param {number} [padFraction]  fraction of range to add as padding (default 0.002 = 0.2%)
 * @returns {{ priceMin: number, priceMax: number }}
 */
export function extractPriceRange(snapshots, padFraction = 0.002) {
  if (!snapshots || snapshots.length === 0) return { priceMin: 0, priceMax: 0 };

  let min = Infinity;
  let max = -Infinity;

  for (const snap of snapshots) {
    for (const l of snap.bids ?? []) {
      const p = parseFloat(Array.isArray(l) ? l[0] : l.price ?? l[0]);
      if (p < min) min = p;
      if (p > max) max = p;
    }
    for (const l of snap.asks ?? []) {
      const p = parseFloat(Array.isArray(l) ? l[0] : l.price ?? l[0]);
      if (p < min) min = p;
      if (p > max) max = p;
    }
  }

  if (!isFinite(min) || !isFinite(max)) return { priceMin: 0, priceMax: 0 };

  const pad = (max - min) * padFraction;
  return { priceMin: min - pad, priceMax: max + pad };
}

/**
 * @typedef {Object} HeatmapCell
 * @property {number} timeIndex   Index into the snapshots array
 * @property {number} price       Bucket price (lower bound)
 * @property {number} bidVol      Total bid volume in this bucket at this time
 * @property {number} askVol      Total ask volume in this bucket at this time
 * @property {number} totalVol    bidVol + askVol
 */

/**
 * Build a flat array of HeatmapCells from a snapshots array.
 * Only cells with totalVol > 0 are included (sparse representation).
 *
 * @param {Array<{bids: any[], asks: any[], timestamp?: number}>} snapshots
 * @param {number} bucketSize  Price step per cell row (e.g. tickSize * 10)
 * @returns {HeatmapCell[]}
 */
export function buildHeatmapCells(snapshots, bucketSize) {
  if (!snapshots || snapshots.length === 0 || !bucketSize) return [];

  const cells = [];

  snapshots.forEach((snap, timeIndex) => {
    const bucketMap = new Map(); // price bucket → { bidVol, askVol }

    const addLevel = (l, side) => {
      const p = parseFloat(Array.isArray(l) ? l[0] : l.price ?? l[0]);
      const q = parseFloat(Array.isArray(l) ? l[1] : l.quantity ?? l.qty ?? l[1]);
      if (!isFinite(p) || !isFinite(q) || q <= 0) return;

      const bucket = priceBucket(p, bucketSize);
      if (!bucketMap.has(bucket)) bucketMap.set(bucket, { bidVol: 0, askVol: 0 });
      const entry = bucketMap.get(bucket);
      entry[side === 'bid' ? 'bidVol' : 'askVol'] += q;
    };

    for (const l of snap.bids ?? []) addLevel(l, 'bid');
    for (const l of snap.asks ?? []) addLevel(l, 'ask');

    for (const [price, { bidVol, askVol }] of bucketMap) {
      const totalVol = bidVol + askVol;
      if (totalVol > 0) {
        cells.push({ timeIndex, price, bidVol, askVol, totalVol });
      }
    }
  });

  return cells;
}
