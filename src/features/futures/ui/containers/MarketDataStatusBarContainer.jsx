import React from 'react';
import MarketDataStatusBar from '../components/MarketDataStatusBar';
import { useFuturesConnectionStore, selectConnectionStatus, selectHealthBySymbol } from '../../application/stores/futuresConnectionStore';

function MarketDataStatusBarContainer({ symbol }) {
  const connectionStatus = useFuturesConnectionStore(selectConnectionStatus);
  const health           = useFuturesConnectionStore(selectHealthBySymbol(symbol));

  return (
    <MarketDataStatusBar
      symbol={symbol}
      connectionStatus={connectionStatus}
      health={health}
    />
  );
}

export default React.memo(MarketDataStatusBarContainer);
