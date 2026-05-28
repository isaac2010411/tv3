import React from 'react'
import { Box, Divider } from '@mui/material'

import OrderBookContainer from '../containers/OrderBookContainer'
import OrderBookImbalanceContainer from '../containers/OrderBookImbalanceContainer'
import LiquidityWallsContainer from '../containers/LiquidityWallsContainer'
import MarketSidebarWorkspace from '../workspaces/MarketSidebarWorkspace'

function MarketSidebarSection({ symbol, loading }) {
  return (
    <MarketSidebarWorkspace>
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden auto',
          borderRight: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ p: 1.5, pb: 1 }}>
          <OrderBookImbalanceContainer symbol={symbol} loading={loading} />
        </Box>
        <Divider />
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <OrderBookContainer symbol={symbol} loading={loading} depth={15} />
        </Box>
        <Divider />
        <Box sx={{ p: 1, pt: 0 }}>
          <LiquidityWallsContainer symbol={symbol} loading={loading} />
        </Box>
      </Box>
    </MarketSidebarWorkspace>
  )
}

export default React.memo(MarketSidebarSection)
