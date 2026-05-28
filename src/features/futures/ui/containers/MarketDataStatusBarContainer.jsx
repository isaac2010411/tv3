import React from 'react';
import MarketDataStatusBar from '../components/MarketDataStatusBar';
import { useFuturesConnectionStore, selectConnectionStatus, selectHealthBySymbol } from '../../application/stores/futuresConnectionStore';
import { useOrderBookStore, selectOrderBookBySymbol } from '../../application/stores/orderBookStore';

function MarketDataStatusBarContainer({ symbol }) {
  const connectionStatus = useFuturesConnectionStore(selectConnectionStatus);
  const health           = useFuturesConnectionStore(selectHealthBySymbol(symbol));
  const orderBook        = useOrderBookStore(selectOrderBookBySymbol(symbol));

  return (
    <MarketDataStatusBar
      symbol={symbol}
      connectionStatus={connectionStatus}
      health={health}
      orderBook={orderBook}
    />
  );
}

export default React.memo(MarketDataStatusBarContainer);
