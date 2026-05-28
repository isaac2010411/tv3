import React, { useState } from 'react'
import {
  Card,
  CardContent,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  ButtonGroup,
  FormControlLabel,
  Switch,
  Alert,
  Stack,
  Divider,
  Typography,
  CircularProgress,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SendIcon from '@mui/icons-material/Send'
import { useValidateFuturesOrder } from '../../application/useValidateFuturesOrder'
import { validateOrder as validateOrderApi, submitOrder } from '../../infrastructure/futuresApiClient'

const INITIAL_ORDER = {
  side: 'BUY',
  type: 'LIMIT',
  quantity: '',
  price: '',
  reduceOnly: false,
  timeInForce: 'GTC',
}

/**
 * Trade ticket form.
 * "Validate" runs local rules + optional server-side POST validate-order.
 * Manual side/execution controls are intentionally hidden.
 */
export default function TradeTicket({ tradingRules, symbol }) {
  const [order, setOrder] = useState(INITIAL_ORDER)
  const [localResult, setLocalResult] = useState(null)
  const [serverResult, setServerResult] = useState(null)
  const [validating, setValidating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)
  const { validate } = useValidateFuturesOrder(tradingRules)

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setOrder((prev) => ({ ...prev, [field]: value }))
    setLocalResult(null)
    setServerResult(null)
    setSubmitResult(null)
  }

  const handleValidate = async () => {
    // 1. Local validation
    const local = validate(order)
    setLocalResult(local)
    if (!local.valid) return // skip server call if local fails

    // 2. Server validation
    if (!symbol) return
    setValidating(true)
    setServerResult(null)
    try {
      const result = await validateOrderApi(symbol, order)
      setServerResult(result)
    } catch (err) {
      setServerResult({ valid: false, errors: [err.message] })
    } finally {
      setValidating(false)
    }
  }

  const handleSubmit = async () => {
    const local = validate(order)
    setLocalResult(local)
    if (!local.valid) return
    if (!symbol) return
    setSubmitting(true)
    setSubmitResult(null)
    try {
      const payload = {
        symbol,
        side: order.side,
        type: order.type,
        quantity: Number(order.quantity),
        price: order.type === 'LIMIT' ? Number(order.price) : undefined,
        timeInForce: order.timeInForce,
        reduceOnly: order.reduceOnly,
      }
      const result = await submitOrder(payload)
      setSubmitResult({ ok: true, order: result?.order || result })
    } catch (err) {
      setSubmitResult({
        ok: false,
        status: err.status,
        code: err.code,
        reason: err.reason || err.message,
        details: err.details,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card variant='outlined'>
      <CardContent>
        <Stack spacing={1.5}>
          {/* Side toggle */}
          <ButtonGroup size='small' fullWidth>
            <Button
              variant={order.side === 'BUY' ? 'contained' : 'outlined'}
              color='success'
              onClick={() => { setOrder((p) => ({ ...p, side: 'BUY' })); setLocalResult(null); setServerResult(null); setSubmitResult(null) }}
              sx={{ fontSize: 11 }}
            >
              BUY
            </Button>
            <Button
              variant={order.side === 'SELL' ? 'contained' : 'outlined'}
              color='error'
              onClick={() => { setOrder((p) => ({ ...p, side: 'SELL' })); setLocalResult(null); setServerResult(null); setSubmitResult(null) }}
              sx={{ fontSize: 11 }}
            >
              SELL
            </Button>
          </ButtonGroup>

          {/* Order type */}
          <FormControl size='small' fullWidth>
            <InputLabel>Type</InputLabel>
            <Select value={order.type} label='Type' onChange={set('type')}>
              {(tradingRules?.orderTypes || ['LIMIT', 'MARKET']).map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Price — only for LIMIT */}
          {order.type === 'LIMIT' && (
            <TextField
              size='small'
              label='Price'
              type='number'
              value={order.price}
              onChange={set('price')}
              fullWidth
              inputProps={{ min: 0, step: tradingRules?.tickSize || 0.01 }}
            />
          )}

          {/* Quantity */}
          <TextField
            size='small'
            label='Quantity'
            type='number'
            value={order.quantity}
            onChange={set('quantity')}
            fullWidth
            inputProps={{ min: 0, step: tradingRules?.stepSize || 0.001 }}
          />

          {/* Time in Force — only for LIMIT */}
          {order.type === 'LIMIT' && (
            <FormControl size='small' fullWidth>
              <InputLabel>Time In Force</InputLabel>
              <Select value={order.timeInForce} label='Time In Force' onChange={set('timeInForce')}>
                {(tradingRules?.timeInForce || ['GTC', 'IOC', 'FOK']).map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <FormControlLabel
            control={<Switch size='small' checked={order.reduceOnly} onChange={set('reduceOnly')} />}
            label={<Typography sx={{ fontSize: 12 }}>Reduce Only</Typography>}
          />

          <Divider />

          {/* Local validation result */}
          {localResult && (
            <Alert severity={localResult.valid ? 'success' : 'error'} sx={{ py: 0.25, fontSize: 11 }}>
              {localResult.valid ? 'Local rules: OK' : localResult.errors.map((e, i) => <div key={i}>{e}</div>)}
            </Alert>
          )}

          {/* Server validation result */}
          {serverResult && (
            <Alert severity={serverResult.valid ? 'success' : 'error'} sx={{ py: 0.25, fontSize: 11 }}>
              {serverResult.valid
                ? 'Server validation: OK'
                : serverResult.errors?.map((e, i) => <div key={i}>{e}</div>)}
            </Alert>
          )}

          <Button
            variant='outlined'
            size='small'
            fullWidth
            onClick={handleValidate}
            disabled={validating || submitting}
            startIcon={validating ? <CircularProgress size={12} /> : <CheckCircleIcon sx={{ fontSize: 14 }} />}
            sx={{ fontSize: 11 }}
          >
            {validating ? 'Checking…' : 'Validate'}
          </Button>

          <Button
            variant='contained'
            size='small'
            fullWidth
            color={order.side === 'BUY' ? 'success' : 'error'}
            onClick={handleSubmit}
            disabled={submitting || validating}
            startIcon={submitting ? <CircularProgress size={12} /> : <SendIcon sx={{ fontSize: 14 }} />}
            sx={{ fontSize: 11 }}
          >
            {submitting ? 'Submitting…' : `Submit ${order.side}`}
          </Button>

          {submitResult && (
            <Alert severity={submitResult.ok ? 'success' : 'error'} sx={{ py: 0.25, fontSize: 11 }}>
              {submitResult.ok
                ? `Submitted — ${submitResult.order?.status || 'NEW'} (${submitResult.order?.orderId || '—'})`
                : (
                  <>
                    <div>{submitResult.code || 'ERROR'}: {submitResult.reason}</div>
                    {submitResult.details?.rule && <div>Rule: {submitResult.details.rule}</div>}
                  </>
                )}
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
