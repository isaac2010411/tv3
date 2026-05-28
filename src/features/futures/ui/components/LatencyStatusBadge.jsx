import React, { useMemo } from 'react'
import { Box, Chip, Tooltip, Typography } from '@mui/material'
import SpeedIcon from '@mui/icons-material/Speed'
import { useRealtimeMetricsStore } from '../../observability/realtimeMetricsStore'

function fmtMs(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return `${Math.round(Number(value))}ms`
}

function fmtRate(value) {
  if (value == null || !Number.isFinite(Number(value))) return '0/s'
  return `${Math.round(Number(value))}/s`
}

function pickLatency(stream) {
  return stream?.backendAuthoritativeMs ?? stream?.backendToFrontendMs ?? stream?.exchangeToFrontendMs ?? null
}

function resolvePrimaryStream(book, trades, cvd, candle) {
  const candidates = [
    { key: 'book', label: 'Book', stream: book },
    { key: 'trades', label: 'Trades', stream: trades },
    { key: 'cvd', label: 'CVD', stream: cvd },
    { key: 'candle', label: 'Candle', stream: candle },
  ]

  for (const candidate of candidates) {
    if (pickLatency(candidate.stream) != null) return candidate
  }

  return { key: 'none', label: 'N/A', stream: null }
}

function pickColor(ms) {
  if (ms == null) return '#6B7280'
  if (ms <= 150) return '#22C55E'
  if (ms <= 500) return '#FBBF24'
  return '#EF4444'
}

export default function LatencyStatusBadge({ symbol }) {
  const bookSelector = useMemo(
    () => (state) => {
      const streams = state.bySymbol[symbol]?.streams ?? {}
      return streams['book.partial'] ?? streams['book.local'] ?? null
    },
    [symbol],
  )
  const tradesSelector = useMemo(() => (state) => state.bySymbol[symbol]?.streams?.['trade.agg'] ?? null, [symbol])
  const cvdSelector = useMemo(() => (state) => state.bySymbol[symbol]?.streams?.['orderflow.cvd'] ?? null, [symbol])
  const candleSelector = useMemo(
    () => (state) => {
      const streams = state.bySymbol[symbol]?.streams ?? {}
      return streams['market.candle.1m'] ?? streams['market.candle.5m'] ?? streams['market.candle.15m'] ?? null
    },
    [symbol],
  )

  const book = useRealtimeMetricsStore(bookSelector)
  const trades = useRealtimeMetricsStore(tradesSelector)
  const cvd = useRealtimeMetricsStore(cvdSelector)
  const candle = useRealtimeMetricsStore(candleSelector)

  const primary = resolvePrimaryStream(book, trades, cvd, candle)
  const primaryLatency = pickLatency(primary.stream)
  const primaryP95 = primary.stream?.p95BackendToFrontendMs ?? null
  const color = pickColor(primaryLatency)

  const tooltip = (
    <Box sx={{ p: 0.5 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 800, mb: 0.5 }}>Realtime latency — {symbol}</Typography>
      <Typography sx={{ fontSize: 10 }}>
        Book: {fmtMs(pickLatency(book))} · {fmtRate(book?.eventsPerSecond)}
      </Typography>
      <Typography sx={{ fontSize: 10 }}>
        Trades: {fmtMs(pickLatency(trades))} · {fmtRate(trades?.eventsPerSecond)}
      </Typography>
      <Typography sx={{ fontSize: 10 }}>
        CVD: {fmtMs(pickLatency(cvd))} · {fmtRate(cvd?.eventsPerSecond)}
      </Typography>
      <Typography sx={{ fontSize: 10 }}>
        Candle: {fmtMs(pickLatency(candle))} · {fmtRate(candle?.eventsPerSecond)}
      </Typography>
      <Typography sx={{ fontSize: 10, mt: 0.5 }}>
        Backend processing:{' '}
        {fmtMs(book?.backendProcessingMs ?? trades?.backendProcessingMs ?? cvd?.backendProcessingMs)}
      </Typography>
      <Typography sx={{ fontSize: 10 }}>
        Front transport (diag):{' '}
        {fmtMs(book?.transportToFrontendMs ?? trades?.transportToFrontendMs ?? cvd?.transportToFrontendMs)}
      </Typography>
      <Typography sx={{ fontSize: 10 }}>
        p95 WS ({primary.label}): {fmtMs(primaryP95)}
      </Typography>
    </Box>
  )

  return (
    <Tooltip title={tooltip} arrow placement='bottom-start'>
      <Chip
        icon={<SpeedIcon sx={{ fontSize: '13px !important', color: `${color} !important` }} />}
        label={`WS lag ${fmtMs(primaryLatency)} (${primary.label}) · Book ${fmtRate(book?.eventsPerSecond)} · Trades ${fmtRate(trades?.eventsPerSecond)}`}
        size='small'
        variant='outlined'
        sx={{
          fontSize: 10,
          height: 20,
          borderColor: color,
          color,
          maxWidth: 280,
          '& .MuiChip-label': { px: 0.75 },
        }}
      />
    </Tooltip>
  )
}
