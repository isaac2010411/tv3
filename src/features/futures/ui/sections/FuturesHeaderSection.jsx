import React from 'react'
import { Box, Typography, Chip, Divider, Tooltip, Skeleton, Alert } from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import AccessTimeIcon from '@mui/icons-material/AccessTime'

import SymbolSelector from '../components/SymbolSelector'
import RealtimeStatusBadge from '../components/RealtimeStatusBadge'
import DecisionRibbonContainer from '../containers/DecisionRibbonContainer'
import MarketDataStatusBarContainer from '../containers/MarketDataStatusBarContainer'
import DashboardHeaderWorkspace from '../workspaces/DashboardHeaderWorkspace'
import { formatPrice, formatPercent, formatCompact, formatDateTime } from '../../utils/formatters'
import { useFuturesConnectionStore, selectSocketErrorBySymbol } from '../../application/stores/futuresConnectionStore'
import {
  useMarketDataStore,
  selectTickerBySymbol,
  selectMarkPriceBySymbol,
} from '../../application/stores/marketDataStore'

function VDivider() {
  return <Divider orientation='vertical' flexItem sx={{ my: '10px', borderColor: 'divider' }} />
}

function TopStat({ label, loading, children }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0 }}>
      <Typography
        sx={{
          fontSize: 9,
          lineHeight: 1.3,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </Typography>
      {loading ? <Skeleton width={56} height={16} /> : children}
    </Box>
  )
}

function FuturesHeaderSection({
  symbol,
  onSymbolChange,
  loading,
  connectionStatus,
  activeContext,
  error,
  imbalanceHistory,
  spoofingEvents,
  shiftEvents,
}) {
  const ticker = useMarketDataStore(selectTickerBySymbol(symbol))
  const markPriceEvent = useMarketDataStore(selectMarkPriceBySymbol(symbol))
  const socketError = useFuturesConnectionStore(selectSocketErrorBySymbol(symbol))

  const lastPrice = ticker?.close ?? ticker?.lastPrice ?? activeContext?.lastPrice
  const pctRaw = ticker?.priceChangePercent ?? activeContext?.priceChangePercent
  const pctVal = parseFloat(pctRaw)
  const pctColor = pctVal >= 0 ? 'success.main' : 'error.main'

  const volume = ticker?.volume ?? activeContext?.volume
  const markPrice = markPriceEvent?.markPrice ?? activeContext?.markPrice
  const indexPrice = markPriceEvent?.indexPrice ?? activeContext?.indexPrice
  const fundingRate = markPriceEvent?.fundingRate ?? activeContext?.fundingRate
  const nextFunding = markPriceEvent?.nextFundingTime ?? activeContext?.nextFundingTime
  const openInterest = activeContext?.openInterest
  const fundColor = parseFloat(fundingRate) >= 0 ? 'success.main' : 'error.main'

  return (
    <>
      <DashboardHeaderWorkspace>
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2,
            height: 52,
            bgcolor: '#080C11',
            borderBottom: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <Typography
            sx={{ fontWeight: 800, fontSize: 13, color: 'primary.main', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}
          >
            FUTURES
          </Typography>
          <VDivider />
          <SymbolSelector value={symbol} onChange={onSymbolChange} />
          <VDivider />
          <TopStat label='Mark' loading={loading}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{formatPrice(markPrice, 2)}</Typography>
          </TopStat>
          <TopStat label='Last / 24h' loading={loading}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{formatPrice(lastPrice, 2)}</Typography>
              {!loading &&
                (pctVal >= 0 ? (
                  <TrendingUpIcon sx={{ fontSize: 12, color: 'success.main' }} />
                ) : (
                  <TrendingDownIcon sx={{ fontSize: 12, color: 'error.main' }} />
                ))}
              <Typography sx={{ fontSize: 11, color: pctColor }}>
                {!isNaN(pctVal) ? `${pctVal >= 0 ? '+' : ''}${pctVal.toFixed(2)}%` : '—'}
              </Typography>
            </Box>
          </TopStat>
          <TopStat label='Index' loading={loading}>
            <Typography sx={{ fontSize: 11 }}>{formatPrice(indexPrice, 2)}</Typography>
          </TopStat>
          <TopStat label='24h Volume' loading={loading}>
            <Typography sx={{ fontSize: 11 }}>{formatCompact(volume)}</Typography>
          </TopStat>
          <TopStat label='Open Interest' loading={loading}>
            <Typography sx={{ fontSize: 11 }}>{formatCompact(openInterest)}</Typography>
          </TopStat>
          <TopStat label='Funding Rate' loading={loading}>
            <Typography sx={{ fontSize: 11, color: fundColor, fontWeight: 600 }}>
              {formatPercent(fundingRate, 4)}
            </Typography>
          </TopStat>
          <Tooltip title='Next funding countdown'>
            <TopStat label='Next Funding' loading={loading}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <AccessTimeIcon sx={{ fontSize: 10, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{formatDateTime(nextFunding)}</Typography>
              </Box>
            </TopStat>
          </Tooltip>
          <Chip
            label={activeContext?.status || 'UNKNOWN'}
            color={activeContext?.status === 'TRADING' ? 'success' : 'warning'}
            size='small'
            sx={{ flexShrink: 0 }}
          />
          <Box sx={{ ml: 'auto', flexShrink: 0 }}>
            <RealtimeStatusBadge status={connectionStatus} />
          </Box>
        </Box>
      </DashboardHeaderWorkspace>

      <MarketDataStatusBarContainer symbol={symbol} />

      {(error || socketError) && (
        <Alert severity='error' sx={{ flexShrink: 0, borderRadius: 0, py: 0.5, fontSize: 12 }}>
          {error || socketError}
        </Alert>
      )}

      <Box sx={{ flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
        <DecisionRibbonContainer
          symbol={symbol}
          imbalanceHistory={imbalanceHistory}
          spoofingCount={spoofingEvents?.length ?? 0}
          shiftCount={shiftEvents?.length ?? 0}
        />
      </Box>
    </>
  )
}

export default React.memo(FuturesHeaderSection)
