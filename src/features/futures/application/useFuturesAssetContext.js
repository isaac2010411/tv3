import { useState, useEffect, useCallback } from 'react';
import { fetchAssetContext } from '../infrastructure/futuresApiClient';
import { createDefaultContext } from '../domain/futuresAssetContext.model';

/**
 * Fetches the full asset context for a futures symbol via REST.
 * Resets and re-fetches whenever `symbol` changes.
 *
 * @param {string} symbol
 * @returns {{ context: Object, loading: boolean, error: string|null, refresh: Function }}
 */
export function useFuturesAssetContext(symbol) {
  const [context, setContext] = useState(createDefaultContext());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (sym) => {
    if (!sym) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAssetContext(sym);
      setContext(data);
    } catch (err) {
      setError(err.message);
      setContext(createDefaultContext());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setContext(createDefaultContext());
    load(symbol);
  }, [symbol, load]);

  return { context, loading, error, refresh: () => load(symbol) };
}
