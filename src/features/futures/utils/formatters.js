/**
 * Format a number as price with fixed decimal places.
 * @param {number|string} value
 * @param {number} decimals
 * @returns {string}
 */
export function formatPrice(value, decimals = 2) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a number as quantity.
 * @param {number|string} value
 * @param {number} decimals
 * @returns {string}
 */
export function formatQty(value, decimals = 4) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (isNaN(n)) return '—';
  return n.toFixed(decimals);
}

/**
 * Format a fraction as a percentage with sign.
 * Pass 0.0012 to get "+0.1200%".
 * @param {number|string} value  fraction (e.g. 0.0012 = 0.12%)
 * @param {number} decimals
 * @returns {string}
 */
export function formatPercent(value, decimals = 4) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (isNaN(n)) return '—';
  const pct = n * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(decimals)}%`;
}

/**
 * Format a number with compact notation (K, M, B).
 * @param {number|string} value
 * @returns {string}
 */
export function formatCompact(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}

/**
 * Format a Unix ms timestamp to HH:MM:SS.
 * @param {number} ts  milliseconds
 * @returns {string}
 */
export function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Format a Unix ms timestamp to locale date + time string.
 * @param {number} ts  milliseconds
 * @returns {string}
 */
export function formatDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', { hour12: false });
}

/**
 * Returns a MUI color path based on numeric price change direction.
 * @param {number} change
 * @returns {'success.main'|'error.main'|'text.secondary'}
 */
export function priceChangeColor(change) {
  if (change > 0) return 'success.main';
  if (change < 0) return 'error.main';
  return 'text.secondary';
}
