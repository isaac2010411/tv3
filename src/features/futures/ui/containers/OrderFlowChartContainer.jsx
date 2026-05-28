import React from 'react';
import OrderFlowChartD3 from '../components/OrderFlowChartD3';
import { useOrderFlowStore, selectRecentTradesBySymbol } from '../../application/stores/orderFlowStore';
import { useFeatureSubscription } from '../../application/subscriptions/useFeatureSubscription';

function OrderFlowChartContainer({ symbol, height = 320 }) {
  // Phase 5 — declare `orderflow` so the plan knows the chart is mounted.
  useFeatureSubscription(symbol, 'orderflow', null);
  const trades = useOrderFlowStore(selectRecentTradesBySymbol(symbol));

  return (
    <OrderFlowChartD3
      trades={trades}
      height={height}
    />
  );
}

export default React.memo(OrderFlowChartContainer);
