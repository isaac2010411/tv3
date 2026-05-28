import React from 'react'
import { Box, Typography, Chip, Stack } from '@mui/material'
import { useSubscriptionPlanStore } from '../application/subscriptions/subscriptionPlanStore'

/**
 * When true the panel renders; otherwise it returns null. Toggle via
 * `REACT_APP_SHOW_SUBSCRIPTION_DEBUG=true` in `.env`.
 */
export const SUBSCRIPTION_DEBUG_ENABLED =
  String(process.env.REACT_APP_SHOW_SUBSCRIPTION_DEBUG || '').toLowerCase() === 'true'

/**
 * Phase 6 — debug panel that visualises the live `SubscriptionPlan` per
 * symbol. Drop it anywhere in the dashboard to see which features and
 * intervals are currently registered and how many mounted consumers each
 * one has. Hidden by default; opt in with REACT_APP_SHOW_SUBSCRIPTION_DEBUG.
 *
 * No new socket traffic; it reads directly from the in-memory plan store.
 */
function SubscriptionPlanDebugPanel() {
  const plans = useSubscriptionPlanStore((s) => s.plans)

  if (!SUBSCRIPTION_DEBUG_ENABLED) return null
  if (!plans || plans.size === 0) {
    return (
      <Box sx={{ p: 1, fontSize: 11, color: 'text.disabled' }}>
        No active subscription plan.
      </Box>
    )
  }

  return (
    <Box sx={{ p: 1, fontSize: 11, fontFamily: 'monospace' }}>
      {Array.from(plans.entries()).map(([symbol, plan]) => (
        <Box key={symbol} sx={{ mb: 1 }}>
          <Typography variant='caption' sx={{ display: 'block', color: 'primary.main', fontWeight: 600 }}>
            {symbol}
          </Typography>
          <Stack direction='row' spacing={0.5} flexWrap='wrap' sx={{ mb: 0.5 }}>
            {Array.from(plan.features.entries()).map(([feature, count]) => (
              <Chip key={feature} size='small' label={`${feature}×${count}`} sx={{ height: 18, fontSize: 10 }} />
            ))}
          </Stack>
          <Stack direction='row' spacing={0.5} flexWrap='wrap'>
            {Array.from(plan.intervals.entries()).map(([interval, count]) => (
              <Chip
                key={interval}
                size='small'
                color='secondary'
                label={`${interval}×${count}`}
                sx={{ height: 18, fontSize: 10 }}
              />
            ))}
          </Stack>
        </Box>
      ))}
    </Box>
  )
}

export default React.memo(SubscriptionPlanDebugPanel)
