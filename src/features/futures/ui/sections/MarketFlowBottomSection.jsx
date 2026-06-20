import React, { useState } from 'react'
import { Box, Tabs, Tab } from '@mui/material'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import TimelineIcon from '@mui/icons-material/Timeline'
import BarChartIcon from '@mui/icons-material/BarChart'
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart'
import ScienceIcon from '@mui/icons-material/Science'

import TapeReaderContainer from '../containers/TapeReaderContainer'
import CvdChartContainer from '../containers/CvdChartContainer'
import ImbalanceTimeseriesD3 from '../components/ImbalanceTimeseriesD3'
import PositionsTable from '../components/PositionsTable'
import OrdersHistoryTable from '../components/OrdersHistoryTable'
import PaperPositionsTable from '../components/PaperPositionsTable'
import SpoofingAlertsPanel from '../components/SpoofingAlertsPanel'
import LiquidityShiftsPanel from '../components/LiquidityShiftsPanel'
import MarketFlowStripWorkspace from '../workspaces/MarketFlowStripWorkspace'
import { usePaperTradeStore, selectOpenPaperPositionsBySymbol } from '../../application/stores/paperTradeStore'

const FLOW_TABS = [
  { label: 'Tape', icon: <FormatListBulletedIcon sx={{ fontSize: 13 }} /> },
  { label: 'CVD', icon: <TimelineIcon sx={{ fontSize: 13 }} /> },
  { label: 'Imbalance', icon: <BarChartIcon sx={{ fontSize: 13 }} /> },
]

function MarketFlowBottomSection({
  symbol,
  activeInterval,
  imbalanceHistory,
  spoofingEvents,
  shiftEvents,
  activeContext,
  loading,
  bottomTab,
  onBottomTabChange,
  posCount,
  orderCount,
}) {
  const [flowTab, setFlowTab] = useState(0)
  const paperOpenCount = usePaperTradeStore(selectOpenPaperPositionsBySymbol(symbol)).length

  return (
    <MarketFlowStripWorkspace>
      <Box
        sx={{
          gridColumn: '1 / 4',
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 0.9fr) minmax(0, 1.6fr)',
          height: '100%',
          borderTop: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ borderRight: '1px solid', borderColor: 'divider', overflow: 'hidden', minWidth: 0 }}>
          <Tabs
            value={flowTab}
            onChange={(_, v) => setFlowTab(v)}
            sx={{ minHeight: 30, px: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#080C11' }}
            TabIndicatorProps={{ style: { height: 2 } }}
          >
            {FLOW_TABS.map(({ label, icon }) => (
              <Tab
                key={label}
                icon={icon}
                iconPosition='start'
                label={label}
                sx={{ minHeight: 30, fontSize: 10, py: 0, px: 1.2, gap: 0.5 }}
              />
            ))}
          </Tabs>
          <Box sx={{ height: 175, overflow: 'hidden' }}>
            {flowTab === 0 && <TapeReaderContainer symbol={symbol} height={175} />}
            {flowTab === 1 && <CvdChartContainer symbol={symbol} interval={activeInterval} height={175} />}
            {flowTab === 2 && <ImbalanceTimeseriesD3 imbalanceHistory={imbalanceHistory} height={175} />}
          </Box>
        </Box>

        <Box sx={{ overflow: 'hidden', minWidth: 0 }}>
          <Tabs
            value={bottomTab}
            onChange={(_, v) => onBottomTabChange(v)}
            sx={{ minHeight: 30, px: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#080C11' }}
            TabIndicatorProps={{ style: { height: 2 } }}
          >
            <Tab
              icon={<AccountBalanceIcon sx={{ fontSize: 13 }} />}
              iconPosition='start'
              label={`Live Pos (${posCount})`}
              sx={{ minHeight: 30, fontSize: 11, py: 0, px: 1.5 }}
            />
            <Tab
              icon={<StackedLineChartIcon sx={{ fontSize: 13 }} />}
              iconPosition='start'
              label={`Live Orders (${orderCount})`}
              sx={{ minHeight: 30, fontSize: 11, py: 0, px: 1.5 }}
            />
            <Tab
              icon={<ScienceIcon sx={{ fontSize: 13 }} />}
              iconPosition='start'
              label={`Paper (${paperOpenCount})`}
              sx={{ minHeight: 30, fontSize: 11, py: 0, px: 1.5 }}
            />
            <Tab
              icon={<WarningAmberIcon sx={{ fontSize: 12 }} />}
              iconPosition='start'
              label={`Alerts (${spoofingEvents.length + shiftEvents.length})`}
              sx={{ minHeight: 30, fontSize: 10, py: 0, px: 1 }}
            />
          </Tabs>
          <Box sx={{ height: 175, overflow: 'hidden auto' }}>
            {bottomTab === 0 && <PositionsTable symbol={symbol} />}
            {bottomTab === 1 && <OrdersHistoryTable />}
            {bottomTab === 2 && <PaperPositionsTable symbol={symbol} />}
            {bottomTab === 3 && (
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', overflow: 'hidden' }}>
                <SpoofingAlertsPanel events={spoofingEvents} height={175} />
                <LiquidityShiftsPanel events={shiftEvents} height={175} />
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </MarketFlowStripWorkspace>
  )
}

export default React.memo(MarketFlowBottomSection)
