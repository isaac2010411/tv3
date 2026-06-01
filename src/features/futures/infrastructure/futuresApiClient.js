import { normalizeServerContext } from '../domain/futuresAssetContext.model'

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'

/**
 * Fetches the full asset context for a given futures symbol.
 * @param {string} symbol e.g. "BTCUSDT"
 * @returns {Promise<Object>}
 */
export async function fetchAssetContext(symbol) {
  const res = await fetch(`${BASE_URL}/api/futures/assets/${encodeURIComponent(symbol)}/context`)
  if (!res.ok) throw new Error(`fetchAssetContext failed: ${res.status} ${res.statusText}`)
  const raw = await res.json()
  return normalizeServerContext(raw)
}

/**
 * Fetches the list of available futures symbols.
 * @returns {Promise<string[]>}
 */
export async function fetchFuturesSymbols() {
  const res = await fetch(`${BASE_URL}/api/futures/symbols`)
  if (!res.ok) throw new Error(`fetchFuturesSymbols failed: ${res.status} ${res.statusText}`)
  return res.json()
}

/**
 * Fetches OHLCV candle data.
 * @param {string} symbol
 * @param {string} interval e.g. "1m", "5m", "15m"
 * @param {number} limit
 * @returns {Promise<Object[]>}
 */
export async function fetchCandles(symbol, interval = '1m', limit = 200) {
  const params = new URLSearchParams({ symbol, interval, limit })
  const res = await fetch(`${BASE_URL}/api/futures/candles?${params}`)
  if (!res.ok) throw new Error(`fetchCandles failed: ${res.status} ${res.statusText}`)
  return res.json()
}

/**
 * Fetches approximate footprint candle history built from kline taker-buy data.
 * Returns an array of backend-enriched footprint plain objects.
 * @param {string} symbol
 * @param {string} interval  e.g. "1m", "5m"
 * @param {number} limit
 * @returns {Promise<Object[]>}
 */
export async function fetchFootprintHistory(symbol, interval = '1m', limit = 50) {
  const params = new URLSearchParams({ symbol, interval, limit })
  const res = await fetch(`${BASE_URL}/api/futures/footprint?${params}`)
  if (!res.ok) throw new Error(`fetchFootprintHistory failed: ${res.status} ${res.statusText}`)
  return res.json()
}

/**
 * Fetches open orders for a symbol (paper/demo only).
 * @param {string} symbol
 * @returns {Promise<Object[]>}
 */
export async function fetchOpenOrders(symbol) {
  const res = await fetch(`${BASE_URL}/api/futures/orders/open?symbol=${encodeURIComponent(symbol)}`)
  if (!res.ok) throw new Error(`fetchOpenOrders failed: ${res.status} ${res.statusText}`)
  return res.json()
}

/**
 * Validates a futures order server-side.
 * POST /api/futures/assets/:symbol/validate-order
 * @param {string} symbol
 * @param {Object} order  { side, type, quantity, price, timeInForce, reduceOnly }
 * @returns {Promise<{ valid: boolean, errors: string[] }>}
 */
export async function validateOrder(symbol, order) {
  const res = await fetch(`${BASE_URL}/api/futures/assets/${encodeURIComponent(symbol)}/validate-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  })
  if (!res.ok) throw new Error(`validateOrder failed: ${res.status} ${res.statusText}`)
  return res.json()
}

/**
 * Fetches positions for a symbol (paper/demo only).
 * @param {string} symbol
 * @returns {Promise<Object[]>}
 */
export async function fetchPositions(symbol) {
  const res = await fetch(`${BASE_URL}/api/futures/positions?symbol=${encodeURIComponent(symbol)}`)
  if (!res.ok) throw new Error(`fetchPositions failed: ${res.status} ${res.statusText}`)
  return res.json()
}

/**
 * Fetches persisted paper positions.
 * @param {Object} params
 * @param {string} [params.symbol]
 * @param {string} [params.status] OPEN|CLOSED
 * @param {number} [params.from]
 * @param {number} [params.to]
 * @param {number} [params.limit=100]
 * @param {number} [params.page=1]
 * @returns {Promise<{items: Object[], total: number, page: number, limit: number}>}
 */
export async function fetchPaperPositions({ symbol, status, from, to, limit = 100, page = 1 } = {}) {
  const params = new URLSearchParams()
  if (symbol) params.set('symbol', symbol)
  if (status) params.set('status', status)
  if (from != null) params.set('from', String(from))
  if (to != null) params.set('to', String(to))
  params.set('limit', String(limit))
  params.set('page', String(page))

  const res = await fetch(`${BASE_URL}/api/futures/paper-positions?${params}`)
  if (!res.ok) throw new Error(`fetchPaperPositions failed: ${res.status} ${res.statusText}`)
  return res.json()
}

/**
 * Fetches persisted explainable signal history.
 * @param {Object} params
 * @param {string} [params.symbol]
 * @param {string} [params.state]
 * @param {string} [params.decision]
 * @param {number} [params.from]
 * @param {number} [params.to]
 * @param {number} [params.limit=100]
 * @param {number} [params.page=1]
 * @returns {Promise<{items: Object[], total: number, page: number, limit: number}>}
 */
export async function fetchSignalHistory({ symbol, state, decision, from, to, limit = 100, page = 1 } = {}) {
  const params = new URLSearchParams()
  if (symbol) params.set('symbol', symbol)
  if (state) params.set('state', state)
  if (decision) params.set('decision', decision)
  if (from != null) params.set('from', String(from))
  if (to != null) params.set('to', String(to))
  params.set('limit', String(limit))
  params.set('page', String(page))

  const res = await fetch(`${BASE_URL}/api/futures/signal-history?${params}`)
  if (!res.ok) throw new Error(`fetchSignalHistory failed: ${res.status} ${res.statusText}`)
  return res.json()
}

// ── Orders Manager (OMS) ─────────────────────────────────────────────────────

async function parseJsonOrThrow(res, label) {
  let body = null
  try { body = await res.json() } catch (_) {}
  if (!res.ok) {
    const err = new Error(body?.message || `${label} failed: ${res.status} ${res.statusText}`)
    err.status = res.status
    err.code = body?.code
    err.details = body?.details
    err.reason = body?.reason
    throw err
  }
  return body
}

/**
 * Submits a new order through the Order Manager.
 * POST /api/futures/orders
 */
export async function submitOrder(payload) {
  const res = await fetch(`${BASE_URL}/api/futures/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJsonOrThrow(res, 'submitOrder')
}

export async function cancelOrder(orderId) {
  const res = await fetch(`${BASE_URL}/api/futures/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'PUT',
  })
  return parseJsonOrThrow(res, 'cancelOrder')
}

export async function fetchOrder(orderId) {
  const res = await fetch(`${BASE_URL}/api/futures/orders/${encodeURIComponent(orderId)}`)
  return parseJsonOrThrow(res, 'fetchOrder')
}

export async function fetchOpenOrdersAll() {
  const res = await fetch(`${BASE_URL}/api/futures/orders/open`)
  return parseJsonOrThrow(res, 'fetchOpenOrdersAll')
}

export async function fetchOrdersList({ symbol, userId, status, limit = 50, page = 1 } = {}) {
  const params = new URLSearchParams()
  if (symbol) params.set('symbol', symbol)
  if (userId) params.set('userId', userId)
  if (status) params.set('status', status)
  params.set('limit', String(limit))
  params.set('page', String(page))
  const res = await fetch(`${BASE_URL}/api/futures/orders?${params}`)
  return parseJsonOrThrow(res, 'fetchOrdersList')
}

// ── Risk Manager ─────────────────────────────────────────────────────────────

export async function fetchRiskLimits() {
  const res = await fetch(`${BASE_URL}/api/futures/risk/limits`)
  return parseJsonOrThrow(res, 'fetchRiskLimits')
}

export async function checkRisk(payload) {
  const res = await fetch(`${BASE_URL}/api/futures/risk/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJsonOrThrow(res, 'checkRisk')
}

// ── Portfolio Manager ────────────────────────────────────────────────────────

export async function fetchPortfolioPositions(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v != null) qs.set(k, String(v)) })
  const url = qs.toString()
    ? `${BASE_URL}/api/futures/portfolio/positions?${qs}`
    : `${BASE_URL}/api/futures/portfolio/positions`
  const res = await fetch(url)
  return parseJsonOrThrow(res, 'fetchPortfolioPositions')
}

export async function fetchPortfolioExposure() {
  const res = await fetch(`${BASE_URL}/api/futures/portfolio/exposure`)
  return parseJsonOrThrow(res, 'fetchPortfolioExposure')
}

export async function fetchPortfolioPerformance() {
  const res = await fetch(`${BASE_URL}/api/futures/portfolio/performance`)
  return parseJsonOrThrow(res, 'fetchPortfolioPerformance')
}

export async function fetchPortfolioSnapshot() {
  const res = await fetch(`${BASE_URL}/api/futures/portfolio/snapshot`)
  return parseJsonOrThrow(res, 'fetchPortfolioSnapshot')
}
