import React from 'react';
import { useMarketDataStore, selectCandlesBySymbolInterval, EMPTY_ARRAY } from '../../application/stores/marketDataStore';
import CandleChartD3 from '../components/CandleChartD3';

export default function CandleChartWorkspaceContainer({ symbol, interval, height }) {
  const candles = useMarketDataStore(selectCandlesBySymbolInterval(symbol, interval));

  return (
    <CandleChartD3
      candles={candles}
      interval={interval}
      height={height}
    />
  );
}

