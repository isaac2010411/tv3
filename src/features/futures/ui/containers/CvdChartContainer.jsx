import React from 'react';
import CvdChartD3 from '../components/CvdChartD3';
import { useOrderFlowStore, selectCvdHistoryBySymbol } from '../../application/stores/orderFlowStore';
import { useFeatureSubscription } from '../../application/subscriptions/useFeatureSubscription';

function CvdChartContainer({ symbol, interval = null, height = 200 }) {
  // Phase 5 — register `cvd` for the active TF only while this chart is
  // mounted, so the backend can scope its accumulator per interval.
  useFeatureSubscription(symbol, 'cvd', interval);
  const cvdHistory = useOrderFlowStore(selectCvdHistoryBySymbol(symbol));
  return <CvdChartD3 cvdHistory={cvdHistory} height={height} />;
}

export default React.memo(CvdChartContainer);
