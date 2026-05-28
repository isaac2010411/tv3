import React from 'react';
import LiquidityWallsPanel from '../components/LiquidityWallsPanel';
import {
  useOrderBookStore,
  selectOrderBookBySymbol,
  selectLocalBookBySymbol,
} from '../../application/stores/orderBookStore';

function LiquidityWallsContainer({ symbol, loading = false }) {
  const localBook = useOrderBookStore(selectLocalBookBySymbol(symbol));
  const partialBook = useOrderBookStore(selectOrderBookBySymbol(symbol));
  const orderBook = localBook ?? partialBook;

  return (
    <LiquidityWallsPanel
      orderBook={orderBook}
      loading={loading}
    />
  );
}

export default React.memo(LiquidityWallsContainer);
