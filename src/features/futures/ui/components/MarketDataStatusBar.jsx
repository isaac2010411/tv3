import React, { useEffect, useRef, useState } from 'react'
import { Box, Chip, Tooltip, Typography } from '@mui/material'
import SyncIcon from '@mui/icons-material/Sync'
import WifiIcon from '@mui/icons-material/Wifi'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import LatencyStatusBadge from './LatencyStatusBadge'

const MAX_STALE_MS = 2000
const MAX_STALE_WARN = 5000

export default function MarketDataStatusBar({ connectionStatus = 'disconnected', health = {}, orderBook, symbol }) {
  const [ageMs, setAgeMs] = useState(null)
  const lastUpdateRef = useRef(Date.now())
  const healthRef = useRef(health)
  useEffect(() => { healthRef.current = health }, [health])
  // Only the *validity* of the top-of-book is relevant for marking a fresh
  // tick — the `orderBook` object itself is a new reference on every depth
  // update, which previously caused this effect to reset `lastUpdateRef`
  // every few ms and made the chip flicker Live ↔ Stale ↔ Degraded forever.
  const bookValid = Boolean(orderBook?.isValidTopOfBook)

  useEffect(() => {
    // Prefer the backend timestamp when available — that is the canonical
    // freshness signal and updates at a sane cadence (no per-tick churn).
    if (health?.lastOrderBookAt) {
      lastUpdateRef.current = health.lastOrderBookAt
      return
    }
    // Local fallback: bump only when the book first becomes valid (or
    // becomes valid again after being invalid). Subsequent depth updates
    // do not re-trigger this effect because we depend on `bookValid`, not
    // on the `orderBook` reference.
    if (bookValid) {
      lastUpdateRef.current = Date.now()
    }
  }, [health?.lastOrderBookAt, bookValid])

  useEffect(() => {
    const id = setInterval(() => {
      // When the backend gives us an age, trust it — that avoids drift
      // between the browser clock and the server clock causing the chip
      // to flap when only one of the two has advanced.
      if (Number.isFinite(healthRef.current?.lastUpdateAgeMs)) {
        setAgeMs(healthRef.current.lastUpdateAgeMs)
      } else {
        setAgeMs(Date.now() - lastUpdateRef.current)
      }
    }, 500)
    return () => clearInterval(id)
  }, [])

  const isConnected = connectionStatus === 'connected'
  const isConnecting = connectionStatus === 'connecting'
  const bookSynced = health.bookSynced ?? orderBook?.isValidTopOfBook ?? false
  const age = ageMs ?? health.lastUpdateAgeMs ?? null
  const reconnects = health.wsReconnectCount ?? 0
  const gapCount = health.gapCount ?? 0

  let dataStatus, dataColor, DataIcon
  if (!isConnected) {
    dataStatus = 'Offline'
    dataColor = '#EF4444'
    DataIcon = WifiOffIcon
  } else if (!bookSynced) {
    dataStatus = 'Syncing…'
    dataColor = '#F59E0B'
    DataIcon = SyncIcon
  } else if (age !== null && age > MAX_STALE_WARN) {
    dataStatus = 'Degraded'
    dataColor = '#F97316'
    DataIcon = WarningAmberIcon
  } else if (age !== null && age > MAX_STALE_MS) {
    dataStatus = 'Stale'
    dataColor = '#FBBF24'
    DataIcon = WarningAmberIcon
  } else {
    dataStatus = 'Live'
    dataColor = '#22C55E'
    DataIcon = WifiIcon
  }

  const connectionColor = isConnected ? '#22C55E' : isConnecting ? '#F59E0B' : '#EF4444'
  const connectionLabel = isConnected ? 'WS Connected' : isConnecting ? 'Connecting…' : 'WS Offline'

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.75,
        px: 1,
        py: 0.4,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        fontSize: 10,
      }}
    >
      <Tooltip title={connectionLabel}>
        <Chip
          icon={
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: connectionColor, ml: '4px !important' }} />
          }
          label={connectionLabel}
          size='small'
          variant='outlined'
          sx={{ fontSize: 10, height: 20, borderColor: connectionColor, color: connectionColor }}
        />
      </Tooltip>

      <Tooltip title={`Market data: ${dataStatus}${age !== null ? ` — book age ${age}ms` : ''}`}>
        <Chip
          icon={<DataIcon sx={{ fontSize: '12px !important', color: `${dataColor} !important` }} />}
          label={dataStatus}
          size='small'
          variant='outlined'
          sx={{ fontSize: 10, height: 20, borderColor: dataColor, color: dataColor }}
        />
      </Tooltip>

      {symbol && <LatencyStatusBadge symbol={symbol} />}

      {reconnects > 0 && (
        <Tooltip title={`WebSocket reconnected ${reconnects} time(s) this session`}>
          <Typography sx={{ fontSize: 10, color: '#9CA3AF' }}>↺{reconnects}</Typography>
        </Tooltip>
      )}

      {gapCount > 0 && (
        <Tooltip title={`${gapCount} sequence gap(s) detected${gapCount === 1 ? ' (startup, resolved)' : ''}`}>
          <Typography sx={{ fontSize: 10, color: !bookSynced || gapCount > 1 ? '#F97316' : '#6B7280' }}>
            Gaps: {gapCount}
          </Typography>
        </Tooltip>
      )}
    </Box>
  )
}
