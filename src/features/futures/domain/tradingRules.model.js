/**
 * @typedef {Object} TradingRules
 * @property {number} tickSize
 * @property {number} stepSize
 * @property {number} minQty
 * @property {number} maxQty
 * @property {number} minNotional
 * @property {string[]} orderTypes
 * @property {string[]} timeInForce
 * @property {number} pricePrecision
 * @property {number} quantityPrecision
 * @property {string} status
 */

/**
 * Parses raw symbol info from exchange info API into TradingRules.
 * @param {Object} raw
 * @returns {TradingRules}
 */
export function parseTradingRules(raw) {
  const filters = raw.filters || [];
  const priceFilter = filters.find((f) => f.filterType === 'PRICE_FILTER') || {};
  const lotFilter = filters.find((f) => f.filterType === 'LOT_SIZE') || {};
  const notionalFilter = filters.find((f) => f.filterType === 'MIN_NOTIONAL') || {};

  return {
    tickSize: parseFloat(priceFilter.tickSize || '0.01'),
    stepSize: parseFloat(lotFilter.stepSize || '0.001'),
    minQty: parseFloat(lotFilter.minQty || '0.001'),
    maxQty: parseFloat(lotFilter.maxQty || '1000'),
    minNotional: parseFloat(notionalFilter.notional || '5'),
    orderTypes: raw.orderTypes || ['LIMIT', 'MARKET'],
    timeInForce: raw.timeInForce || ['GTC', 'IOC', 'FOK'],
    pricePrecision: raw.pricePrecision || 2,
    quantityPrecision: raw.quantityPrecision || 3,
    status: raw.status || 'TRADING',
  };
}
