/**
 * SignalEnginePanel
 *
 * Displays the real-time output of the StateMachineSignalEngine:
 *  - Current state badge with transition history
 *  - Score bar (directional)
 *  - Confidence indicator
 *  - Per-factor score breakdown
 *  - Missing context warnings
 *  - Local position display with PnL
 */

import React, { useMemo } from 'react'
import { Box, Typography, Chip, Button, Divider, Tooltip, LinearProgress } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'

import { useSignalEngine } from '../../application/useSignalEngine'
import { calcUnrealizedPnL } from '../../domain/signalEngine/LocalPositionGuard'
import SignalPopup from './SignalPopup'
import {
  SIGNAL_STATES,
} from '../../domain/signalEngine/signalEngineStates'

// ─── Missing context labels ────────────────────────────────────────────────────

const MISSING_CONTEXT_LABELS = {
  orderBook: 'Order book no disponible (esperando snapshot)',
  candles: 'Historial de velas insuficiente (mínimo 50 velas cerradas)',
  cvd: 'CVD sin datos suficientes (esperando trades)',
}

function missingContextLabel(key) {
  return MISSING_CONTEXT_LABELS[key] ?? key
}

// ─── State display config ─────────────────────────────────────────────────────

const STATE_CONFIG = {
  [SIGNAL_STATES.IDLE]: { color: '#64748B', label: 'IDLE', desc: 'Sin contexto de mercado definido' },
  [SIGNAL_STATES.OBSERVING]: { color: '#94A3B8', label: 'OBSERVANDO', desc: 'Detectando primeras señales' },
  [SIGNAL_STATES.LONG_BIAS]: { color: '#3B82F6', label: 'SESGO LONG', desc: 'Evidencia alcista acumulándose' },
  [SIGNAL_STATES.SHORT_BIAS]: { color: '#F97316', label: 'SESGO SHORT', desc: 'Evidencia bajista acumulándose' },
  [SIGNAL_STATES.LONG_SETUP]: { color: '#22C55E', label: 'SETUP LONG', desc: 'Configuración long en progreso' },
  [SIGNAL_STATES.SHORT_SETUP]: { color: '#EF4444', label: 'SETUP SHORT', desc: 'Configuración short en progreso' },
  [SIGNAL_STATES.LONG_ENTRY_SIGNAL]: {
    color: '#22C55E',
    label: '⚡ ENTRADA LONG',
    desc: 'Señal de entrada LONG activa',
  },
  [SIGNAL_STATES.SHORT_ENTRY_SIGNAL]: {
    color: '#EF4444',
    label: '⚡ ENTRADA SHORT',
    desc: 'Señal de entrada SHORT activa',
  },
  [SIGNAL_STATES.LONG_POSITION_OPEN]: { color: '#22C55E', label: 'LONG ABIERTO', desc: 'Posición LONG activa' },
  [SIGNAL_STATES.SHORT_POSITION_OPEN]: { color: '#EF4444', label: 'SHORT ABIERTO', desc: 'Posición SHORT activa' },
  [SIGNAL_STATES.LONG_EXIT_WARNING]: {
    color: '#F59E0B',
    label: '⚠ ADVERTENCIA LONG',
    desc: 'La posición LONG está bajo presión',
  },
  [SIGNAL_STATES.SHORT_EXIT_WARNING]: {
    color: '#F59E0B',
    label: '⚠ ADVERTENCIA SHORT',
    desc: 'La posición SHORT está bajo presión',
  },
  [SIGNAL_STATES.LONG_EXIT_SIGNAL]: { color: '#F97316', label: '🔴 SALIDA LONG', desc: 'Señal de cierre LONG activa' },
  [SIGNAL_STATES.SHORT_EXIT_SIGNAL]: {
    color: '#F97316',
    label: '🔴 SALIDA SHORT',
    desc: 'Señal de cierre SHORT activa',
  },
  [SIGNAL_STATES.COOLDOWN]: { color: '#64748B', label: 'COOLDOWN', desc: 'Esperando próxima ventana' },
  [SIGNAL_STATES.INVALIDATED]: { color: '#6B7280', label: 'INVALIDADO', desc: 'Condiciones de mercado cambiaron' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreBar({ netScore }) {
  const pct = ((netScore + 1) / 2) * 100
  const color = netScore > 0.1 ? '#22C55E' : netScore < -0.1 ? '#EF4444' : '#64748B'
  const sign = netScore > 0.05 ? '+' : ''
  const label = `${sign}${(netScore * 100).toFixed(0)}`
  const biasText = netScore > 0.1
    ? 'Sesgo LONG'
    : netScore < -0.1
      ? 'Sesgo SHORT'
      : 'Neutral'

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
        <Typography sx={{ fontSize: 9, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Sesgo direccional
        </Typography>
        <Typography sx={{ fontSize: 9, color, fontWeight: 700 }}>
          {biasText} · {label}
        </Typography>
      </Box>
      {/* Track */}
      <Box sx={{ height: 6, borderRadius: 3, bgcolor: '#1E293B', position: 'relative', overflow: 'hidden' }}>
        {/* Center marker */}
        <Box sx={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, bgcolor: '#334155', zIndex: 1 }} />
        {/* Score fill */}
        <Box
          sx={{
            position: 'absolute',
            height: '100%',
            borderRadius: 3,
            bgcolor: color,
            transition: 'all 0.3s ease',
            ...(netScore >= 0
              ? { left: '50%', width: `${Math.abs(pct - 50)}%` }
              : { right: `${100 - pct}%`, width: `${Math.abs(pct - 50)}%` }),
          }}
        />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
        <Typography sx={{ fontSize: 9, color: '#EF4444' }}>SHORT</Typography>
        <Typography sx={{ fontSize: 9, color: '#22C55E' }}>LONG</Typography>
      </Box>
    </Box>
  )
}

function ConfidenceBar({ confidence }) {
  const pct = Math.round(confidence) // confidence is already 0-100 from backend
  const color = pct >= 70 ? '#22C55E' : pct >= 45 ? '#F59E0B' : '#EF4444'

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography sx={{ fontSize: 10, color: 'text.secondary', minWidth: 72 }}>Confianza</Typography>
      <LinearProgress
        variant='determinate'
        value={pct}
        sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: '#1E293B', '& .MuiLinearProgress-bar': { bgcolor: color } }}
      />
      <Typography sx={{ fontSize: 10, color, fontWeight: 700, minWidth: 32, textAlign: 'right' }}>{pct}%</Typography>
    </Box>
  )
}

function FactorRow({ reason }) {
  // Backend now sends reasons as objects: { label, side, weight }. Older
  // builds may still emit plain strings — handle both.
  const isObj = reason && typeof reason === 'object'
  const label = isObj ? (reason.label ?? String(reason)) : String(reason)
  const side = isObj ? reason.side : null
  const sideConfig = side === 'LONG'
    ? { color: '#22C55E', tag: 'L', bg: 'rgba(34,197,94,0.12)' }
    : side === 'SHORT'
      ? { color: '#EF4444', tag: 'S', bg: 'rgba(239,68,68,0.12)' }
      : { color: '#3B82F6', tag: '·', bg: 'rgba(59,130,246,0.12)' }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
      <Box
        sx={{
          minWidth: 16,
          height: 14,
          borderRadius: 0.5,
          bgcolor: sideConfig.bg,
          color: sideConfig.color,
          fontSize: 9,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          flexShrink: 0,
        }}
      >
        {sideConfig.tag}
      </Box>
      <Typography
        sx={{
          fontSize: 10,
          color: sideConfig.color,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}

function LocalPositionCard({ position, currentPrice, onClose }) {
  const pnl = calcUnrealizedPnL(position, currentPrice)

  const pnlColor = !pnl ? '#94A3B8' : pnl.pnl > 0 ? '#22C55E' : '#EF4444'
  const dirColor = position.direction === 'LONG' ? '#22C55E' : '#EF4444'

  return (
    <Box sx={{ border: '1px solid #1E293B', borderRadius: 1, p: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <FiberManualRecordIcon sx={{ fontSize: 8, color: dirColor }} />
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: dirColor }}>
            {position.direction} — {position.symbol}
          </Typography>
        </Box>
        <Chip label='LOCAL' size='small' sx={{ height: 14, fontSize: 8, bgcolor: '#1E293B', color: '#64748B' }} />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 0.75 }}>
        <Box>
          <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Entrada</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.primary' }}>{position.entryPrice?.toFixed(2) ?? '—'}</Typography>
        </Box>
        {position.stopLoss && (
          <Box>
            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Stop</Typography>
            <Typography sx={{ fontSize: 11, color: '#EF4444' }}>{position.stopLoss.toFixed(2)}</Typography>
          </Box>
        )}
        {position.takeProfit && (
          <Box>
            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Take Profit</Typography>
            <Typography sx={{ fontSize: 11, color: '#22C55E' }}>{position.takeProfit.toFixed(2)}</Typography>
          </Box>
        )}
        {pnl && (
          <Box>
            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>PnL</Typography>
            <Typography sx={{ fontSize: 11, color: pnlColor, fontWeight: 700 }}>
              {pnl.pnl >= 0 ? '+' : ''}
              {pnl.pnl.toFixed(2)} ({pnl.pnlPct >= 0 ? '+' : ''}
              {pnl.pnlPct.toFixed(3)}%)
            </Typography>
          </Box>
        )}
      </Box>

      <Button
        size='small'
        variant='outlined'
        color='error'
        onClick={onClose}
        sx={{ fontSize: 10, py: 0.25, px: 1, height: 22 }}
      >
        Cerrar posición (local)
      </Button>
    </Box>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {string} props.symbol   – active trading symbol
 * @param {string} [props.interval='1m']
 */
function SignalEnginePanel({ symbol, interval = '1m' }) {
  const {
    engineResult,
    position,
    hasOpenPosition,
    currentPrice,
    isPopupOpen,
    popupSignal,
    popupState,
    popupAutoExecution,
    acceptSignal,
    rejectSignal,
    closePosition,
    acceptExitSignal,
    dismissPopup,
  } = useSignalEngine(symbol, interval)

  const { state, netScore, confidence, reasons, missingContext } = engineResult

  const stateCfg = STATE_CONFIG[state] ?? { color: '#64748B', label: state, desc: '' }

  const visibleReasons = useMemo(() => (Array.isArray(reasons) ? reasons : []), [reasons])

  if (!symbol) {
    return (
      <Box sx={{ p: 1.5 }}>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
          Selecciona un símbolo para activar el motor de señales.
        </Typography>
      </Box>
    )
  }

  return (
    <>
      <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Motor de Señales
          </Typography>
          <Tooltip title={stateCfg.desc}>
            <Chip
              label={stateCfg.label}
              size='small'
              sx={{
                height: 18,
                fontSize: 10,
                fontWeight: 700,
                bgcolor: `${stateCfg.color}20`,
                color: stateCfg.color,
                border: `1px solid ${stateCfg.color}40`,
              }}
            />
          </Tooltip>
        </Box>

        {/* Score bar */}
        <ScoreBar netScore={netScore} />

        {/* Confidence */}
        <ConfidenceBar confidence={confidence} />

        <Divider sx={{ borderColor: '#1E293B' }} />

        {/* Local position */}
        {hasOpenPosition && <LocalPositionCard position={position} currentPrice={currentPrice} onClose={closePosition} />}

        <Divider sx={{ borderColor: '#1E293B' }} />

        {/* Factor breakdown */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography
              sx={{ fontSize: 9, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
              Factores ({visibleReasons.length})
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <Typography sx={{ fontSize: 8, color: '#22C55E' }}>L = long</Typography>
              <Typography sx={{ fontSize: 8, color: '#EF4444' }}>S = short</Typography>
            </Box>
          </Box>
          {visibleReasons.map((r, i) => (
            <FactorRow key={r?.factor ?? r?.id ?? r?.label ?? `${String(r)}-${i}`} reason={r} />
          ))}
        </Box>

        {/* Missing context */}
        {missingContext.length > 0 && (
          <>
            <Divider sx={{ borderColor: '#1E293B' }} />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                <InfoOutlinedIcon sx={{ fontSize: 11, color: '#F59E0B' }} />
                <Typography sx={{ fontSize: 9, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Contexto faltante
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 10, color: '#64748B' }}>
                {missingContext.map(missingContextLabel).join(' · ')}
              </Typography>
            </Box>
          </>
        )}
      </Box>

      {/* ── Signal popup (Dialog portal — renders over the entire viewport) ── */}
      <SignalPopup
        open={isPopupOpen}
        state={popupState}
        signal={popupSignal}
        autoExecution={popupAutoExecution}
        hasOpenPosition={hasOpenPosition}
        onAccept={acceptSignal}
        onReject={rejectSignal}
        onClose={acceptExitSignal}
        onDismiss={dismissPopup}
      />
    </>
  )
}

export default React.memo(SignalEnginePanel)
