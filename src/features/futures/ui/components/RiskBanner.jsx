import React, { useEffect, useState } from 'react'
import { Snackbar, Alert } from '@mui/material'
import { useRiskStore, selectLastRiskDecision } from '../../application/stores/riskStore'

const SEVERITY_BY_ACTION = {
  BLOCK: 'error',
  REDUCE: 'warning',
  ALLOW: 'success',
}

/**
 * Floating banner that surfaces the latest Risk Manager decision.
 * Auto-hides successful ALLOW decisions, keeps BLOCK/REDUCE visible until dismissed.
 */
export default function RiskBanner() {
  const decision = useRiskStore(selectLastRiskDecision)
  const clearLastDecision = useRiskStore((s) => s.clearLastDecision)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (decision) setOpen(true)
  }, [decision])

  if (!decision) return null

  const severity = SEVERITY_BY_ACTION[decision.action] || 'info'
  const autoHideDuration = decision.action === 'ALLOW' ? 3000 : null

  const handleClose = (_e, reason) => {
    if (reason === 'clickaway') return
    setOpen(false)
    clearLastDecision()
  }

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert severity={severity} onClose={handleClose} variant='filled' sx={{ fontSize: 12 }}>
        <strong>{decision.action}</strong>
        {decision.rule ? ` · ${decision.rule}` : ''}
        {decision.reason ? ` — ${decision.reason}` : ''}
        {decision.symbol ? ` (${decision.symbol})` : ''}
      </Alert>
    </Snackbar>
  )
}
