import React from 'react';
import LiquidityWallsPanel from '../components/LiquidityWallsPanel';
import {
  useOrderBookStore,
  selectBookMetricsBySymbol,
} from '../../application/stores/orderBookStore';

function LiquidityWallsContainer({ symbol, loading = false }) {
  const bookMetrics = useOrderBookStore(selectBookMetricsBySymbol(symbol));

  return (
    <LiquidityWallsPanel
      bookMetrics={bookMetrics}
      loading={loading}
    />
  );
}

export default React.memo(LiquidityWallsContainer);
