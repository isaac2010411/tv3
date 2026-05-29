/**
 * Central source of truth for supported candle intervals across the futures
 * feature. Any hook, store or component that needs to know "which timeframes
 * exist" must import from here — never hard-code arrays like
 * `['1m', '5m', '15m']` again.
 */

export const INTERVALS = ['1m', '5m', '15m', '1h', '4h']

export const DEFAULT_INTERVAL = '1m'

const INTERVAL_SET = new Set(INTERVALS)

export function isValidInterval(interval) {
  return typeof interval === 'string' && INTERVAL_SET.has(interval)
}

export function normalizeInterval(interval) {
  return isValidInterval(interval) ? interval : DEFAULT_INTERVAL
}

const INTERVAL_MS = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
}

export function intervalToMs(interval) {
  return INTERVAL_MS[interval] ?? 0
}
