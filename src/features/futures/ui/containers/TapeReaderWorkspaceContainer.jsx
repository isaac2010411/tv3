import React from 'react';
import { useOrderFlowStore, selectRecentTradesBySymbol } from '../../application/stores/orderFlowStore';
import TapeReaderPanel from '../components/TapeReaderPanel';

export default function TapeReaderWorkspaceContainer({ symbol, height = 205 }) {
  const recentTrades = useOrderFlowStore(selectRecentTradesBySymbol(symbol));

  return <TapeReaderPanel trades={recentTrades} height={height} />;
}

