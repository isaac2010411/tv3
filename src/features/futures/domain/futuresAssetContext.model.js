/**
 * @typedef {Object} FuturesAssetContext
 * @property {string} symbol
 * @property {string} contractType
 * @property {string} status
 * @property {string} baseAsset
 * @property {string} quoteAsset
 * @property {number} markPrice
 * @property {number} indexPrice
 * @property {number} fundingRate
 * @property {number} nextFundingTime
 * @property {number} lastPrice
 * @property {number} priceChangePercent
 * @property {number} volume
 * @property {number} openInterest
 * @property {Object|null} tradingRules
 * @property {Object|null} orderBook
 * @property {Object[]} positions
 * @property {Object[]} openOrders
 */

/**
 * Creates a default (empty) FuturesAssetContext.
 * @returns {FuturesAssetContext}
 */
export function createDefaultContext() {
  return {
    symbol: '',
    contractType: '',
    status: '',
    baseAsset: '',
    quoteAsset: '',
    markPrice: 0,
    indexPrice: 0,
    fundingRate: 0,
    nextFundingTime: 0,
    lastPrice: 0,
    priceChangePercent: 0,
    volume: 0,
    openInterest: 0,
    tradingRules: null,
    orderBook: null,
    positions: [],
    openOrders: [],
  };
}

/**
 * Normalizes the nested server context (returned by REST or socket) into the
 * flat FuturesAssetContext shape expected by all UI components.
 *
 * Server shape:
 *   { symbol, exchangeInfo, tradingRules, market: { markPrice, openInterest, ticker24h }, orderbook, account }
 *
 * @param {object} raw
 * @returns {FuturesAssetContext}
 */
export function normalizeServerContext(raw) {
  if (!raw) return createDefaultContext();

  const ei      = raw.exchangeInfo    ?? {};
  const market  = raw.market          ?? {};
  const mp      = market.markPrice    ?? {};
  const oi      = market.openInterest ?? {};
  const t24     = market.ticker24h    ?? {};
  const account = raw.account         ?? {};

  return {
    symbol:             raw.symbol               ?? '',
    contractType:       ei.contractType           ?? '',
    status:             ei.status                 ?? '',
    baseAsset:          ei.baseAsset              ?? '',
    quoteAsset:         ei.quoteAsset             ?? '',
    markPrice:          mp.markPrice              ?? 0,
    indexPrice:         mp.indexPrice             ?? 0,
    fundingRate:        mp.lastFundingRate         ?? 0,
    nextFundingTime:    mp.nextFundingTime         ?? 0,
    lastPrice:          t24.lastPrice              ?? 0,
    priceChangePercent: t24.priceChangePercent     ?? 0,
    volume:             t24.volume                 ?? 0,
    openInterest:       oi.openInterest            ?? 0,
    tradingRules:       raw.tradingRules           ?? null,
    orderBook:          raw.orderbook ?? null,
    positions:          account.positions          ?? [],
    openOrders:         account.openOrders         ?? [],
  };
}
