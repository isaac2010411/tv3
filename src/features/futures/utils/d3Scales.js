import * as d3 from 'd3';

/**
 * Creates a scaleTime for candle open times.
 * @param {Object[]} data  candles with numeric `openTime`
 * @param {number} width   available inner width
 * @param {number[]} padding  [left, right] pixel padding inside range
 * @returns {d3.ScaleTime<number, number>}
 */
export function createTimeScale(data, width, padding = [0, 0]) {
  const extent = d3.extent(data, (d) => new Date(d.openTime));
  return d3.scaleTime().domain(extent).range([padding[0], width - padding[1]]);
}

/**
 * Creates a linear y-scale for OHLC price data.
 * Adds 2% padding above and below the visible range.
 * @param {Object[]} data  candles with `low` and `high`
 * @param {number} height  available inner height
 * @param {number[]} padding  [top, bottom] pixel padding
 * @returns {d3.ScaleLinear<number, number>}
 */
export function createPriceScale(data, height, padding = [0, 0]) {
  const minVal = d3.min(data, (d) => d.low);
  const maxVal = d3.max(data, (d) => d.high);
  const range = maxVal - minVal;
  return d3
    .scaleLinear()
    .domain([minVal - range * 0.02, maxVal + range * 0.02])
    .range([height - padding[1], padding[0]]);
}

/**
 * Creates a linear y-scale for volume bars.
 * @param {Object[]} data  candles with numeric `volume`
 * @param {number} height  available bar area height
 * @returns {d3.ScaleLinear<number, number>}
 */
export function createVolumeScale(data, height) {
  const maxVol = d3.max(data, (d) => d.volume);
  return d3.scaleLinear().domain([0, (maxVol || 1) * 1.1]).range([height, 0]);
}

/**
 * Creates a linear x-scale for depth chart cumulative quantities.
 * @param {number[]} quantities  array of cumulative values
 * @param {number} width
 * @returns {d3.ScaleLinear<number, number>}
 */
export function createDepthScale(quantities, width) {
  return d3.scaleLinear().domain([0, d3.max(quantities) || 1]).range([0, width]);
}
