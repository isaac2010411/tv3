import React from 'react';
import { useOrderBookStore, selectOrderBookBySymbol } from '../../application/stores/orderBookStore';
import { useOrderFlowStore, selectCvdHistoryBySymbol } from '../../application/stores/orderFlowStore';
import ScalpingDecisionRibbon from '../components/ScalpingDecisionRibbon';

export default function DecisionRibbonContainer({ symbol, imbalanceHistory = [], spoofingCount = 0, shiftCount = 0 }) {
  const orderBook  = useOrderBookStore(selectOrderBookBySymbol(symbol));
  const cvdHistory = useOrderFlowStore(selectCvdHistoryBySymbol(symbol));

  return (
    <ScalpingDecisionRibbon
      cvdHistory={cvdHistory}
      imbalanceHistory={imbalanceHistory}
      orderBook={orderBook}
      spoofingCount={spoofingCount}
      shiftCount={shiftCount}
    />
  );
}
