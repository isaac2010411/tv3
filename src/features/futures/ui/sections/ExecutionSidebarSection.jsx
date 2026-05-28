import React from 'react'
import { Box, Divider } from '@mui/material'

import FundingPanel from '../components/FundingPanel'
import TradingRulesPanel from '../components/TradingRulesPanel'
import SignalEnginePanel from '../components/SignalEnginePanel'
import ExecutionSidebarWorkspace from '../workspaces/ExecutionSidebarWorkspace'
import { useMarketDataStore, selectMarkPriceBySymbol } from '../../application/stores/marketDataStore'

function ExecutionSidebarSection({ symbol, interval, activeContext, loading }) {
  const markPriceEvent = useMarketDataStore(selectMarkPriceBySymbol(symbol))

  return (
    <ExecutionSidebarWorkspace>
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden auto',
          borderLeft: '1px solid',
          borderColor: 'divider',
        }}
      >
        <SignalEnginePanel symbol={symbol} interval={interval} />
        <Divider />
        <Box sx={{ p: 1.5 }}>
          <FundingPanel context={activeContext} realtimeMarkPrice={markPriceEvent} loading={loading} />
        </Box>
        <Divider />
        <Box sx={{ p: 1.5 }}>
          <TradingRulesPanel tradingRules={activeContext?.tradingRules} loading={loading} />
        </Box>
      </Box>
    </ExecutionSidebarWorkspace>
  )
}

export default React.memo(ExecutionSidebarSection)
