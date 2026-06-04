import React, { useState, useRef, useEffect } from 'react'
import { Box, Card, Tabs, Tab } from '@mui/material'

import CandleChartD3 from '../components/CandleChartD3'
import ChartWorkspace from '../workspaces/ChartWorkspace'
import { INTERVALS } from '../state/useFuturesDashboardState'
import { useMarketDataStore, selectCandlesBySymbolInterval } from '../../application/stores/marketDataStore'

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

function ChartSection({ symbol, intervalIdx, onIntervalChange, interval }) {
  const candles = useMarketDataStore(selectCandlesBySymbolInterval(symbol, interval))

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
            </Box>
            <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0, p: 0.5 }}>
              <AutoHeightChart>
                {(h) => (
                  <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                    <CandleChartD3 candles={candles} interval={interval} height={h} />
                  </Box>
                )}
              </AutoHeightChart>
            </Box>
          </Card>
        </Box>
      </Box>
    </ChartWorkspace>
  )
}

export default React.memo(ChartSection)
