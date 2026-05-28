import React, { useState, useEffect, useMemo } from 'react'
import { Box } from '@mui/material'

function formatRemaining(ms) {
  const totalSecs = Math.max(0, Math.floor(ms / 1000))
  const mm = String(Math.floor(totalSecs / 60)).padStart(2, '0')
  const ss = String(totalSecs % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/**
 * Standalone memoized countdown timer.
 * Manages its own 1-second interval so CandleChartD3 is not forced to
 * re-render every second.
 */
const CandleCountdownTimer = React.memo(function CandleCountdownTimer({ lastCandleOpenTime, intervalMs }) {
  const [now, setNow] = useState(() => Date.now())
  const [lastAdvanceAt, setLastAdvanceAt] = useState(() => Date.now())

  useEffect(() => {
    if (!lastCandleOpenTime || intervalMs <= 0) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [lastCandleOpenTime, intervalMs])

  useEffect(() => {
    if (!lastCandleOpenTime) return
    setLastAdvanceAt(Date.now())
  }, [lastCandleOpenTime])

  const { label, isStale } = useMemo(() => {
    if (!lastCandleOpenTime || intervalMs <= 0) {
      return { label: null, isStale: false }
    }
    const remainingMs = lastCandleOpenTime + intervalMs - now
    if (remainingMs > 0) {
      return { label: formatRemaining(remainingMs), isStale: false }
    }

    const staleMs = now - lastAdvanceAt
    const staleThreshold = Math.max(Math.floor(intervalMs * 1.5), 90_000)
    if (staleMs >= staleThreshold) {
      return { label: 'STALE', isStale: true }
    }

    return { label: '00:00', isStale: false }
  }, [lastCandleOpenTime, intervalMs, now, lastAdvanceAt])

  if (!label) return null

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 18,
        right: 96,
        zIndex: 2,
        px: 0.5,
        py: 0.15,
        borderRadius: '4px',
        fontSize: 10,
        lineHeight: 1.2,
        fontWeight: 800,
        color: isStale ? '#F87171' : '#FBBF24',
        bgcolor: 'rgba(8, 12, 17, 0.76)',
        border: isStale ? '1px solid rgba(248, 113, 113, 0.28)' : '1px solid rgba(251, 191, 36, 0.18)',
        pointerEvents: 'none',
      }}
    >
      {label}
    </Box>
  )
})

export default CandleCountdownTimer
