import React from 'react';
import TapeReaderPanel from '../components/TapeReaderPanel';
import { useOrderFlowStore, selectRecentTradesBySymbol } from '../../application/stores/orderFlowStore';
import { useFeatureSubscription } from '../../application/subscriptions/useFeatureSubscription';

function TapeReaderContainer({ symbol, height = 320 }) {
  // Phase 5 — declare `tape` as a mount-scoped feature so the subscription
  // plan reflects this widget being visible.
  useFeatureSubscription(symbol, 'tape', null);
  const trades = useOrderFlowStore(selectRecentTradesBySymbol(symbol));
  return <TapeReaderPanel trades={trades} height={height} />;
}

export default React.memo(TapeReaderContainer);
