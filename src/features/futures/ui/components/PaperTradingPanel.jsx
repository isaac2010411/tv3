import React, { useEffect, useMemo, useState } from 'react'
import { Box, Typography, Divider, Chip } from '@mui/material'
import {
  usePaperTradeStore,
  selectOpenPaperPositionsBySymbol,
  selectClosedPaperPositionsBySymbol,
} from '../../application/stores/paperTradeStore'
import { fetchSignalHistory } from '../../infrastructure/futuresApiClient'

function formatPrice(value) {
  if (!Number.isFinite(Number(value))) return '-'
  return Number(value).toFixed(2)
}

function formatPnl(value) {
  if (!Number.isFinite(Number(value))) return '-'
  const n = Number(value)
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`
}

function MetricPill({ label, value, tone = 'default' }) {
  const color = tone === 'positive' ? '#22C55E' : tone === 'negative' ? '#EF4444' : '#94A3B8'
  return (
    <Box sx={{ px: 0.8, py: 0.4, borderRadius: 1, border: '1px solid #1E293B', bgcolor: '#0B1220' }}>
      <Typography sx={{ fontSize: 9, color: '#64748B', lineHeight: 1 }}>{label}</Typography>
      <Typography sx={{ fontSize: 11, color, fontWeight: 700, lineHeight: 1.1 }}>{value}</Typography>
    </Box>
  )
}

function PositionRow({ position }) {
  const dirColor = position.direction === 'LONG' ? '#22C55E' : '#EF4444'
  return (
    <Box sx={{ py: 0.5, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 10, color: dirColor, fontWeight: 700 }}>
          {position.direction} {position.symbol}
        </Typography>
        <Typography sx={{ fontSize: 9, color: '#64748B' }}>
          Entrada {formatPrice(position.entryPrice)} | Actual {formatPrice(position.currentPrice)}
        </Typography>
        {Number.isFinite(Number(position.quantity)) && (
          <Typography sx={{ fontSize: 9, color: '#64748B' }}>
            Cantidad {Number(position.quantity).toFixed(4)}
          </Typography>
        )}
      </Box>
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          color: Number(position.unrealizedPnl) >= 0 ? '#22C55E' : '#EF4444',
          whiteSpace: 'nowrap',
        }}
      >
        {formatPnl(position.unrealizedPnl)}
      </Typography>
    </Box>
  )
}

function PaperTradingPanel({ symbol }) {
  const openPositions = usePaperTradeStore(selectOpenPaperPositionsBySymbol(symbol))
  const closedPositions = usePaperTradeStore(selectClosedPaperPositionsBySymbol(symbol))

  const [isHydrating, setIsHydrating] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [recentDecisions, setRecentDecisions] = useState([])

  useEffect(() => {
    let active = true
    if (!symbol)
      return () => {
        active = false
      }

    const loadHistory = async () => {
      setIsHydrating(true)
      setHistoryError(null)

      try {
        const historyRes = await fetchSignalHistory({ symbol, limit: 20, page: 1 })

        if (!active) return
        setRecentDecisions((historyRes?.items ?? []).slice(0, 5))
      } catch (err) {
        if (!active) return
        setHistoryError(err.message)
      } finally {
        if (active) setIsHydrating(false)
      }
    }

    loadHistory()

    return () => {
      active = false
    }
  }, [symbol])

  const metrics = useMemo(() => {
    const totalUnrealized = openPositions.reduce((acc, p) => acc + (Number(p.unrealizedPnl) || 0), 0)
    const totalRealized = closedPositions.reduce((acc, p) => acc + (Number(p.realizedPnl) || 0), 0)
    const wins = closedPositions.filter((p) => Number(p.realizedPnl) > 0).length
    const winRate = closedPositions.length > 0 ? (wins / closedPositions.length) * 100 : 0

    return {
      totalUnrealized,
      totalRealized,
      winRate,
    }
  }, [openPositions, closedPositions])

  const latestClosed = closedPositions.slice(0, 3)

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
        <Typography
          sx={{
            fontSize: 10,
            fontWeight: 700,
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Paper Trading
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip
            label={`${openPositions.length} abiertas`}
            size='small'
            sx={{ height: 16, fontSize: 9, bgcolor: '#0B1220', border: '1px solid #1E293B', color: '#94A3B8' }}
          />
          <Chip
            label={isHydrating ? 'sync...' : 'mongo'}
            size='small'
            sx={{
              height: 16,
              fontSize: 9,
              bgcolor: '#0B1220',
              border: '1px solid #1E293B',
              color: isHydrating ? '#F59E0B' : '#22C55E',
            }}
          />
        </Box>
      </Box>

      {historyError && (
        <Typography sx={{ fontSize: 10, color: '#F59E0B', mb: 0.5 }}>
          Historial no disponible: {historyError}
        </Typography>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.6, mb: 0.8 }}>
        <MetricPill
          label='PnL abierto'
          value={formatPnl(metrics.totalUnrealized)}
          tone={metrics.totalUnrealized >= 0 ? 'positive' : 'negative'}
        />
        <MetricPill
          label='PnL cerrado'
          value={formatPnl(metrics.totalRealized)}
          tone={metrics.totalRealized >= 0 ? 'positive' : 'negative'}
        />
        <MetricPill label='Winrate' value={`${metrics.winRate.toFixed(0)}%`} tone='default' />
      </Box>

      <Divider sx={{ borderColor: '#1E293B', mb: 0.6 }} />

      <Typography sx={{ fontSize: 9, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Posiciones abiertas
      </Typography>
      {openPositions.length === 0 ? (
        <Typography sx={{ fontSize: 10, color: '#64748B', py: 0.6 }}>Sin posiciones paper abiertas.</Typography>
      ) : (
        openPositions.slice(0, 4).map((position) => <PositionRow key={position.id} position={position} />)
      )}

      <Divider sx={{ borderColor: '#1E293B', my: 0.6 }} />

      <Typography sx={{ fontSize: 9, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Historial de señales
      </Typography>
      {recentDecisions.length === 0 ? (
        <Typography sx={{ fontSize: 10, color: '#64748B', py: 0.6 }}>
          Sin señales persistidas para este simbolo.
        </Typography>
      ) : (
        recentDecisions.map((item) => (
          <Box key={item._id ?? `${item.timestamp}-${item.state}`} sx={{ py: 0.35 }}>
            <Typography sx={{ fontSize: 9, color: '#94A3B8' }}>{item.state}</Typography>
          </Box>
        ))
      )}

      <Divider sx={{ borderColor: '#1E293B', my: 0.6 }} />

      <Typography sx={{ fontSize: 9, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Ultimos cierres
      </Typography>
      {latestClosed.length === 0 ? (
        <Typography sx={{ fontSize: 10, color: '#64748B', py: 0.6 }}>Aun no hay cierres paper.</Typography>
      ) : (
        latestClosed.map((position) => (
          <Box key={position.id} sx={{ py: 0.5, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{ fontSize: 10, color: '#94A3B8' }}>
              {position.direction} {position.symbol}
            </Typography>
            <Typography
              sx={{ fontSize: 10, fontWeight: 700, color: Number(position.realizedPnl) >= 0 ? '#22C55E' : '#EF4444' }}
            >
              {formatPnl(position.realizedPnl)}
            </Typography>
          </Box>
        ))
      )}
    </Box>
  )
}

export default React.memo(PaperTradingPanel)
