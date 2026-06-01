import React, { useState, useRef, useEffect } from 'react'
import { Box, Card, Tabs, Tab, Divider } from '@mui/material'
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart'
import WaterfallChartIcon from '@mui/icons-material/WaterfallChart'
import BarChartIcon from '@mui/icons-material/BarChart'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'

import CandleChartD3 from '../components/CandleChartD3'
import DepthChartD3 from '../components/DepthChartD3'
import OrderFlowChartContainer from '../containers/OrderFlowChartContainer'
import LiquidityHeatmapD3 from '../components/LiquidityHeatmapD3'
import FootprintCandleD3 from '../components/FootprintCandleD3'
import ChartWorkspace from '../workspaces/ChartWorkspace'
import { INTERVALS } from '../state/useFuturesDashboardState'
import { useMarketDataStore, selectCandlesBySymbolInterval, selectMarkPriceBySymbol } from '../../application/stores/marketDataStore'
import {
  useOrderBookStore,
  selectOrderBookBySymbol,
  selectLocalBookBySymbol,
  selectTopOfBookBySymbol,
  selectBookMetricsBySymbol,
} from '../../application/stores/orderBookStore'

const CHART_TABS = [
  { label: 'Candles', icon: <CandlestickChartIcon sx={{ fontSize: 14 }} /> },
  { label: 'Depth', icon: <WaterfallChartIcon sx={{ fontSize: 14 }} /> },
  { label: 'Order Flow', icon: <BarChartIcon sx={{ fontSize: 14 }} /> },
  { label: 'Heatmap', icon: <GridViewIcon sx={{ fontSize: 14 }} /> },
  { label: 'Footprint', icon: <ViewColumnIcon sx={{ fontSize: 14 }} /> },
]

function AutoHeightChart({ children }) {
  const ref = useRef(null)
  const [h, setH] = useState(420)

  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const px = Math.floor(e.contentRect.height)
        if (px > 80) setH(px)
      }
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  return (
    <Box ref={ref} sx={{ height: '100%', minHeight: 0 }}>
      {children(h)}
    </Box>
  )
}

function ChartSection({
  symbol,
  intervalIdx,
  onIntervalChange,
  chartTab,
  onChartTabChange,
  interval,
  footprints,
  currentFootprints,
  heatmapSnapshots,
  heatmapMinutes,
  setHeatmapMinutes,
}) {
  const candles = useMarketDataStore(selectCandlesBySymbolInterval(symbol, interval))
  const partialBook = useOrderBookStore(selectOrderBookBySymbol(symbol))
  const localBook = useOrderBookStore(selectLocalBookBySymbol(symbol))
  const orderBook = localBook ?? partialBook
  const topOfBook = useOrderBookStore(selectTopOfBookBySymbol(symbol))
  const bookMetrics = useOrderBookStore(selectBookMetricsBySymbol(symbol))
  const markPriceEvent = useMarketDataStore(selectMarkPriceBySymbol(symbol))

  const markPrice = markPriceEvent?.markPrice ?? null
  const midPrice = bookMetrics?.midPrice ?? topOfBook?.midPrice ?? null

  return (
    <ChartWorkspace>
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Box sx={{ flex: 1, overflow: 'hidden', p: 1, pb: 0, minHeight: 0 }}>
          <Card variant='outlined' sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderBottom: '1px solid',
                borderColor: 'divider',
                flexShrink: 0,
              }}
            >
              <Tabs
                value={intervalIdx}
                onChange={(_, v) => onIntervalChange(v)}
                sx={{ minHeight: 28 }}
                TabIndicatorProps={{ style: { height: 2 } }}
              >
                {INTERVALS.map((iv) => (
                  <Tab key={iv} label={iv} sx={{ minHeight: 28, py: 0, minWidth: 36, fontSize: 11 }} />
                ))}
              </Tabs>
              <Divider orientation='vertical' flexItem sx={{ my: '6px' }} />
              <Tabs
                value={chartTab}
                onChange={(_, v) => onChartTabChange(v)}
                sx={{ minHeight: 28 }}
                TabIndicatorProps={{ style: { height: 2 } }}
              >
                {CHART_TABS.map(({ label, icon }) => (
                  <Tab
                    key={label}
                    icon={icon}
                    iconPosition='start'
                    label={label}
                    sx={{ minHeight: 28, py: 0, px: 1.5, fontSize: 11, gap: 0.5 }}
                  />
                ))}
              </Tabs>
            </Box>
            <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0, p: 0.5 }}>
              <AutoHeightChart>
                {(h) => {
                  const fpHistory = [
                    ...(footprints.get(interval) ?? []),
                    ...(currentFootprints.get(interval) ? [currentFootprints.get(interval)] : []),
                  ]
                  return (
                    <>
                      {chartTab === 0 && (
                        <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                          <CandleChartD3 candles={candles} interval={interval} height={h} />
                        </Box>
                      )}
                      {chartTab === 1 && <DepthChartD3 orderBook={orderBook} markPrice={markPrice} height={h} />}
                      {chartTab === 2 && <OrderFlowChartContainer symbol={symbol} height={h} />}
                      {chartTab === 3 && (
                        <LiquidityHeatmapD3
                          snapshots={heatmapSnapshots}
                          minutes={heatmapMinutes}
                          onMinutesChange={setHeatmapMinutes}
                          midPrice={midPrice}
                          height={h}
                        />
                      )}
                      {chartTab === 4 && <FootprintCandleD3 footprints={fpHistory} interval={interval} height={h} />}
                    </>
                  )
                }}
              </AutoHeightChart>
            </Box>
          </Card>
        </Box>
      </Box>
    </ChartWorkspace>
  )
}

export default React.memo(ChartSection)
