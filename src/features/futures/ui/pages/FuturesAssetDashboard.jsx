import React from 'react';
import { Box } from '@mui/material';
import { useRenderPerf } from '../../observability/useRenderPerf';
import { useFuturesDashboardState, INTERVALS } from '../state/useFuturesDashboardState';
import { useOrdersState } from '../../application/useOrdersState';
import { usePortfolioState } from '../../application/usePortfolioState';
import { useRiskState } from '../../application/useRiskState';

import FuturesTradingLayout    from '../layout/FuturesTradingLayout';
import FuturesHeaderSection    from '../sections/FuturesHeaderSection';
import MarketSidebarSection    from '../sections/MarketSidebarSection';
import ChartSection            from '../sections/ChartSection';
import ExecutionSidebarSection from '../sections/ExecutionSidebarSection';
import MarketFlowBottomSection from '../sections/MarketFlowBottomSection';
import RiskBanner              from '../components/RiskBanner';
import PortfolioSummaryCard    from '../components/PortfolioSummaryCard';

export default function FuturesAssetDashboard() {
  const s = useFuturesDashboardState();
  useRenderPerf(s.symbol, 'FuturesAssetDashboard');

  // Manager subscriptions (account-level, independent of symbol).
  useOrdersState();
  usePortfolioState();
  useRiskState();

  return (
    <>
      <RiskBanner />
      <FuturesTradingLayout
        header={
          <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1, width: '100%' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <FuturesHeaderSection
                symbol={s.symbol}
                onSymbolChange={s.setSymbol}
                loading={s.loading}
                connectionStatus={s.connectionStatus}
                activeContext={s.activeContext}
                error={s.error}
                imbalanceHistory={s.imbalanceHistory}
                spoofingEvents={s.spoofingEvents}
                shiftEvents={s.shiftEvents}
              />
            </Box>
            <PortfolioSummaryCard />
          </Box>
        }
        left={
          <MarketSidebarSection
            symbol={s.symbol}
            loading={s.loading}
          />
        }
        center={
          <ChartSection
            symbol={s.symbol}
            intervalIdx={s.intervalIdx}
            onIntervalChange={s.setIntervalIdx}
            interval={INTERVALS[s.intervalIdx]}
          />
        }
        right={
          <ExecutionSidebarSection
            symbol={s.symbol}
            interval={INTERVALS[s.intervalIdx]}
            activeContext={s.activeContext}
            loading={s.loading}
          />
        }
        bottom={
          <MarketFlowBottomSection
            symbol={s.symbol}
            activeInterval={s.activeInterval}
            imbalanceHistory={s.imbalanceHistory}
            spoofingEvents={s.spoofingEvents}
            shiftEvents={s.shiftEvents}
            activeContext={s.activeContext}
            loading={s.loading}
            bottomTab={s.bottomTab}
            onBottomTabChange={s.setBottomTab}
            posCount={s.posCount}
            orderCount={s.orderCount}
          />
        }
      />
    </>
  );
}
