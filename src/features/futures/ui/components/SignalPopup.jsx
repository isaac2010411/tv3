/**
 * SignalPopup
 *
 * Professional MUI Dialog that appears when the signal engine emits an
 * actionable state: entry, exit, exit warning, or invalidation.
 *
 * Visual hierarchy:
 *  1. Colored header  — type / direction / confidence chip
 *  2. Score bar       — directional indicator
 *  3. Confidence bar  — 0–100%
 *  4. Signal summary  — one-line description
 *  5. Risk box        — entry · SL · TP · R/R  (entry signals only)
 *  6. Reasons list    — scored factors
 *  7. Missing context — data quality warnings
 *  8. Action buttons  — Accept / Reject / Cerrar Posición / Ignorar / Entendido
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Chip,
  Button,
  Divider,
  LinearProgress,
} from '@mui/material';
import TrendingUpIcon      from '@mui/icons-material/TrendingUp';
import TrendingDownIcon    from '@mui/icons-material/TrendingDown';
import WarningAmberIcon    from '@mui/icons-material/WarningAmber';
import BlockIcon           from '@mui/icons-material/Block';
import ExitToAppIcon       from '@mui/icons-material/ExitToApp';
import CheckCircleIcon     from '@mui/icons-material/CheckCircle';
import CancelIcon          from '@mui/icons-material/Cancel';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import InfoOutlinedIcon    from '@mui/icons-material/InfoOutlined';

import {
  SIGNAL_STATES,
  ENTRY_SIGNAL_STATES,
  EXIT_SIGNAL_STATES,
  EXIT_WARNING_STATES,
} from '../../domain/signalEngine/signalEngineStates';

// ─── Visual config per state ──────────────────────────────────────────────────

const STATE_VISUAL = {
  [SIGNAL_STATES.LONG_ENTRY_SIGNAL]: {
    color:     '#22C55E',
    label:     '⚡ ENTRADA LONG',
    headerBg:  'rgba(34, 197, 94, 0.06)',
    Icon:      TrendingUpIcon,
  },
  [SIGNAL_STATES.SHORT_ENTRY_SIGNAL]: {
    color:     '#EF4444',
    label:     '⚡ ENTRADA SHORT',
    headerBg:  'rgba(239, 68, 68, 0.06)',
    Icon:      TrendingDownIcon,
  },
  [SIGNAL_STATES.LONG_EXIT_WARNING]: {
    color:     '#F59E0B',
    label:     '⚠ ADVERTENCIA — LONG',
    headerBg:  'rgba(245, 158, 11, 0.06)',
    Icon:      WarningAmberIcon,
  },
  [SIGNAL_STATES.SHORT_EXIT_WARNING]: {
    color:     '#F59E0B',
    label:     '⚠ ADVERTENCIA — SHORT',
    headerBg:  'rgba(245, 158, 11, 0.06)',
    Icon:      WarningAmberIcon,
  },
  [SIGNAL_STATES.LONG_EXIT_SIGNAL]: {
    color:     '#F97316',
    label:     '🔴 SALIDA LONG',
    headerBg:  'rgba(249, 115, 22, 0.06)',
    Icon:      ExitToAppIcon,
  },
  [SIGNAL_STATES.SHORT_EXIT_SIGNAL]: {
    color:     '#F97316',
    label:     '🔴 SALIDA SHORT',
    headerBg:  'rgba(249, 115, 22, 0.06)',
    Icon:      ExitToAppIcon,
  },
  [SIGNAL_STATES.INVALIDATED]: {
    color:     '#6B7280',
    label:     'SEÑAL INVALIDADA',
    headerBg:  'rgba(107, 114, 128, 0.06)',
    Icon:      BlockIcon,
  },
};

const MISSING_CONTEXT_LABELS = {
  orderBook: 'Order book no disponible (esperando snapshot)',
  candles:   'Historial de velas insuficiente (mínimo 50 velas)',
  cvd:       'CVD sin datos suficientes (esperando trades)',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({ netScore }) {
  const pct   = ((netScore + 1) / 2) * 100;
  const color = netScore > 0.1 ? '#22C55E' : netScore < -0.1 ? '#EF4444' : '#64748B';
  const label = netScore > 0.05
    ? `+${(netScore * 100).toFixed(0)}`
    : (netScore * 100).toFixed(0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
        <Typography sx={{ fontSize: 9, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score</Typography>
        <Typography sx={{ fontSize: 10, color, fontWeight: 700, fontFamily: 'Roboto Mono, monospace' }}>{label}</Typography>
      </Box>
      <Box sx={{ height: 4, borderRadius: 2, bgcolor: '#1E293B', position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, bgcolor: '#334155', zIndex: 1 }} />
        <Box
          sx={{
            position: 'absolute',
            height: '100%',
            borderRadius: 2,
            bgcolor: color,
            transition: 'all 0.3s ease',
            ...(netScore >= 0
              ? { left: '50%', width: `${Math.abs(pct - 50)}%` }
              : { right: `${100 - pct}%`, width: `${Math.abs(pct - 50)}%` }),
          }}
        />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.3 }}>
        <Typography sx={{ fontSize: 8, color: '#EF4444' }}>SHORT</Typography>
        <Typography sx={{ fontSize: 8, color: '#22C55E' }}>LONG</Typography>
      </Box>
    </Box>
  );
}

function ConfidenceBar({ confidence }) {
  const pct   = Math.round(confidence);
  const color = pct >= 70 ? '#22C55E' : pct >= 45 ? '#F59E0B' : '#EF4444';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography sx={{ fontSize: 9, color: 'text.secondary', minWidth: 60, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Confianza
      </Typography>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          flex: 1,
          height: 4,
          borderRadius: 2,
          bgcolor: '#1E293B',
          '& .MuiLinearProgress-bar': { bgcolor: color },
        }}
      />
      <Typography sx={{ fontSize: 11, color, fontWeight: 700, minWidth: 34, textAlign: 'right', fontFamily: 'Roboto Mono, monospace' }}>
        {pct}%
      </Typography>
    </Box>
  );
}

function RiskBox({ risk }) {
  return (
    <Box
      sx={{
        border: '1px solid #1E293B',
        borderRadius: 1,
        p: 1.25,
        bgcolor: '#080C11',
      }}
    >
      <Typography sx={{ fontSize: 9, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>
        Parámetros de Riesgo
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1 }}>
        <Box>
          <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Entrada</Typography>
          <Typography sx={{ fontSize: 12, color: '#94A3B8', fontWeight: 700, fontFamily: 'Roboto Mono, monospace' }}>
            {Number(risk.entryPrice).toFixed(2)}
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Stop Loss</Typography>
          <Typography sx={{ fontSize: 12, color: '#EF4444', fontWeight: 700, fontFamily: 'Roboto Mono, monospace' }}>
            {Number(risk.stopLoss).toFixed(2)}
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Take Profit</Typography>
          <Typography sx={{ fontSize: 12, color: '#22C55E', fontWeight: 700, fontFamily: 'Roboto Mono, monospace' }}>
            {Number(risk.takeProfit).toFixed(2)}
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>R/R</Typography>
          <Typography sx={{ fontSize: 12, color: '#F59E0B', fontWeight: 700 }}>
            {risk.riskReward ?? '—'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function ReasonsList({ reasons }) {
  if (!reasons || reasons.length === 0) return null;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography sx={{ fontSize: 9, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Factores ({reasons.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <Typography sx={{ fontSize: 8, color: '#22C55E' }}>L = long</Typography>
          <Typography sx={{ fontSize: 8, color: '#EF4444' }}>S = short</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
        {reasons.map((r, i) => {
          const isObj = r && typeof r === 'object';
          const label = isObj ? (r.label ?? String(r)) : String(r);
          const side = isObj ? r.side : null;
          const cfg = side === 'LONG'
            ? { color: '#22C55E', tag: 'L', bg: 'rgba(34,197,94,0.12)' }
            : side === 'SHORT'
              ? { color: '#EF4444', tag: 'S', bg: 'rgba(239,68,68,0.12)' }
              : { color: '#3B82F6', tag: '·', bg: 'rgba(59,130,246,0.12)' };
          return (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{
                minWidth: 16, height: 14, borderRadius: 0.5,
                bgcolor: cfg.bg, color: cfg.color,
                fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>{cfg.tag}</Box>
              <Typography sx={{ fontSize: 10, color: cfg.color, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function MissingContextBox({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <Box
      sx={{
        bgcolor: 'rgba(245,158,11,0.05)',
        border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: 1,
        p: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
        <InfoOutlinedIcon sx={{ fontSize: 11, color: '#F59E0B' }} />
        <Typography sx={{ fontSize: 9, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Contexto faltante
        </Typography>
      </Box>
      {items.map((k, i) => (
        <Typography key={i} sx={{ fontSize: 10, color: '#64748B' }}>
          · {MISSING_CONTEXT_LABELS[k] ?? k}
        </Typography>
      ))}
    </Box>
  );
}

// ─── Confidence chip color helper ─────────────────────────────────────────────

function confidenceChipSx(confidence) {
  if (confidence >= 70) {
    return {
      bgcolor: 'rgba(34,197,94,0.12)',
      color: '#22C55E',
      border: '1px solid rgba(34,197,94,0.3)',
    };
  }
  if (confidence >= 45) {
    return {
      bgcolor: 'rgba(245,158,11,0.12)',
      color: '#F59E0B',
      border: '1px solid rgba(245,158,11,0.3)',
    };
  }
  return {
    bgcolor: 'rgba(239,68,68,0.12)',
    color: '#EF4444',
    border: '1px solid rgba(239,68,68,0.3)',
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * @param {Object}       props
 * @param {boolean}      props.open            – controls visibility
 * @param {string}       props.state           – current signal state (SIGNAL_STATES)
 * @param {object|null}  props.signal          – active signal object from backend
 * @param {boolean}      props.hasOpenPosition – whether a local position is open
 * @param {Function}     props.onAccept        – accept entry signal
 * @param {Function}     props.onReject        – reject entry signal (no position opened)
 * @param {Function}     props.onClose         – close open position (for exit/warning)
 * @param {Function}     props.onDismiss       – close popup without acting
 */
export default function SignalPopup({
  open,
  state,
  signal,
  hasOpenPosition,
  autoExecution,
  onAccept,
  onReject,
  onClose,
  onDismiss,
}) {
  const visual   = STATE_VISUAL[state] ?? STATE_VISUAL[SIGNAL_STATES.INVALIDATED];
  const { color, label, headerBg, Icon } = visual;

  const isEntrySignal   = ENTRY_SIGNAL_STATES.has(state);
  const isExitSignal    = EXIT_SIGNAL_STATES.has(state);
  const isWarning       = EXIT_WARNING_STATES.has(state);
  const isInvalidated   = state === SIGNAL_STATES.INVALIDATED;
  const isExitOrWarning = isExitSignal || isWarning;
  const isAutoExecuted  = autoExecution?.mode === 'AUTO' && autoExecution?.approved === true;
  const isManualReview  = autoExecution?.mode === 'MANUAL';
  const isAutoRejected  = autoExecution?.mode === 'REJECT';
  // The position is being autonomously managed by the Risk Manager when the
  // backend tags the decision scope as POSITION. In that case warnings/exits
  // are purely informational — the user does not need to act.
  const isPositionAutoManaged = autoExecution?.scope === 'POSITION';
  const activeRules = Array.isArray(autoExecution?.activeRules)
    ? autoExecution.activeRules
    : [];

  const confidence = signal?.confidence   ?? 0;
  const score      = signal?.score        ?? 0;
  const reasons    = signal?.reasons      ?? [];
  const missing    = signal?.missingContext ?? [];
  const risk       = signal?.risk         ?? null;
  const summary    = signal?.summary      ?? null;

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      onClose={onDismiss}
      PaperProps={{
        sx: {
          bgcolor: '#0D1117',
          border: `1px solid ${color}50`,
          borderRadius: 2,
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${color}18`,
          overflow: 'hidden',
        },
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: headerBg,
          borderBottom: `1px solid ${color}20`,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Icon sx={{ fontSize: 17, color }} />
            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 700,
                color,
                letterSpacing: '-0.2px',
              }}
            >
              {label}
            </Typography>
          </Box>

          {!isInvalidated && (
            <Chip
              label={`${Math.round(confidence)}%`}
              size="small"
              sx={{
                height: 20,
                fontSize: 10,
                fontWeight: 700,
                ...confidenceChipSx(confidence),
              }}
            />
          )}
        </Box>

        {/* Symbol + direction metadata */}
        {signal?.symbol && (
          <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.4 }}>
            {signal.symbol}
            {signal.direction && (
              <> · <span style={{ color }}>{signal.direction.toUpperCase()}</span></>
            )}
          </Typography>
        )}

        {/* Invalidation message */}
        {isInvalidated && (
          <Typography sx={{ fontSize: 11, color: '#94A3B8', mt: 0.75, lineHeight: 1.5 }}>
            Las condiciones de mercado cambiaron. La señal anterior fue cancelada.
          </Typography>
        )}
      </Box>

      {/* ── Body (hidden for INVALIDATED) ──────────────────────────────── */}
      {!isInvalidated && (
        <DialogContent
          sx={{
            p: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            '&.MuiDialogContent-root': { pt: 1.5 },
          }}
        >
          {/* Score + Confidence */}
          <ScoreBar netScore={score} />
          <ConfidenceBar confidence={confidence} />

          {/* One-line signal summary */}
          {summary && (
            <>
              <Divider sx={{ borderColor: '#1E293B' }} />
              <Typography sx={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.5 }}>
                {summary}
              </Typography>
            </>
          )}

          {/* Risk parameters — entry signals only */}
          {isEntrySignal && risk && (
            <>
              <Divider sx={{ borderColor: '#1E293B' }} />
              <RiskBox risk={risk} />
            </>
          )}

          {/* Reasons / scored factors */}
          {reasons.length > 0 && (
            <>
              <Divider sx={{ borderColor: '#1E293B' }} />
              <ReasonsList reasons={reasons} />
            </>
          )}

          {/* Missing context warnings */}
          {missing.length > 0 && (
            <MissingContextBox items={missing} />
          )}

          {/* Risk Manager auto-execution banner */}
          {autoExecution && (
            <Box
              sx={{
                mt: 0.5,
                p: 1,
                borderRadius: 1,
                bgcolor: isAutoExecuted
                  ? 'rgba(34,197,94,0.08)'
                  : isAutoRejected
                    ? 'rgba(107,114,128,0.08)'
                    : 'rgba(245,158,11,0.08)',
                border: `1px solid ${
                  isAutoExecuted ? '#22C55E40' : isAutoRejected ? '#6B728040' : '#F59E0B40'
                }`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.4 }}>
                {isAutoExecuted ? (
                  <CheckCircleIcon sx={{ fontSize: 12, color: '#22C55E' }} />
                ) : isAutoRejected ? (
                  <BlockIcon sx={{ fontSize: 12, color: '#9CA3AF' }} />
                ) : (
                  <InfoOutlinedIcon sx={{ fontSize: 12, color: '#F59E0B' }} />
                )}
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: isAutoExecuted ? '#22C55E' : isAutoRejected ? '#9CA3AF' : '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {isAutoExecuted
                    ? `Risk Manager · auto-ejecutado (${autoExecution.regime})`
                    : isAutoRejected
                      ? `Risk Manager · señal descartada (${autoExecution.regime})`
                      : `Risk Manager · revisión manual (${autoExecution.regime})`}
                </Typography>
                {autoExecution.executionMode && (
                  <Chip
                    label={autoExecution.executionMode === 'auto' ? '100% AUTO' : 'SEMI-MANUAL'}
                    size="small"
                    sx={{
                      ml: 0.5,
                      height: 16,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      bgcolor: autoExecution.executionMode === 'auto' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                      color: autoExecution.executionMode === 'auto' ? '#22C55E' : '#F59E0B',
                      border: `1px solid ${autoExecution.executionMode === 'auto' ? '#22C55E40' : '#F59E0B40'}`,
                    }}
                  />
                )}
              </Box>
              {autoExecution.reasons?.slice(0, 3).map((r, i) => (
                <Typography key={i} sx={{ fontSize: 10, color: '#94A3B8', lineHeight: 1.45 }}>
                  · {r}
                </Typography>
              ))}
              {autoExecution.adjustedRisk && isAutoExecuted && (
                <Typography sx={{ fontSize: 10, color: '#64748B', mt: 0.4, fontFamily: 'Roboto Mono, monospace' }}>
                  SL {autoExecution.adjustedRisk.stopLoss} · TP {autoExecution.adjustedRisk.takeProfit} · R/R {autoExecution.adjustedRisk.riskReward}
                </Typography>
              )}
              {isPositionAutoManaged && autoExecution.action && (
                <Typography sx={{ fontSize: 10, color: '#64748B', mt: 0.4, fontFamily: 'Roboto Mono, monospace' }}>
                  Acción: {autoExecution.action}
                  {Number.isFinite(autoExecution.newStopLoss) && ` → SL ${autoExecution.newStopLoss}`}
                  {autoExecution.closeReason && ` (${autoExecution.closeReason})`}
                </Typography>
              )}
              {activeRules.length > 0 && (
                <Box sx={{ mt: 0.6, pt: 0.6, borderTop: '1px dashed #1E293B' }}>
                  <Typography sx={{ fontSize: 9, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.3 }}>
                    Reglas activas
                  </Typography>
                  {activeRules.map((r, i) => (
                    <Typography key={i} sx={{ fontSize: 10, color: '#94A3B8', lineHeight: 1.4 }}>
                      · {r}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      )}

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <DialogActions
        sx={{
          px: 1.5,
          pb: 1.5,
          pt: isInvalidated ? 1 : 0.5,
          gap: 0.75,
          justifyContent: 'flex-end',
        }}
      >
        {/* ENTRY SIGNAL — auto-executed by Risk Manager: informational only */}
        {isEntrySignal && isAutoExecuted && (
          <Button
            variant="outlined"
            size="small"
            onClick={onDismiss}
            sx={{ fontSize: 11, py: 0.5, borderColor: '#334155', color: 'text.secondary' }}
          >
            Entendido
          </Button>
        )}

        {/* ENTRY SIGNAL — manual review (Risk Manager did not auto-accept) */}
        {isEntrySignal && !hasOpenPosition && !isAutoExecuted && !isAutoRejected && (
          <>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CancelIcon sx={{ fontSize: 13 }} />}
              onClick={onReject}
              sx={{
                fontSize: 11,
                py: 0.5,
                borderColor: '#334155',
                color: 'text.secondary',
                '&:hover': { borderColor: '#475569', bgcolor: 'rgba(255,255,255,0.03)' },
              }}
            >
              Rechazar
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<CheckCircleIcon sx={{ fontSize: 13 }} />}
              onClick={onAccept}
              sx={{
                fontSize: 11,
                py: 0.5,
                bgcolor: color,
                '&:hover': { bgcolor: isEntrySignal && state === SIGNAL_STATES.LONG_ENTRY_SIGNAL ? '#16A34A' : '#DC2626' },
              }}
            >
              Aceptar (local)
            </Button>
          </>
        )}

        {/* ENTRY SIGNAL — Risk Manager descartó la señal */}
        {isEntrySignal && isAutoRejected && (
          <Button
            variant="outlined"
            size="small"
            onClick={onDismiss}
            sx={{ fontSize: 11, py: 0.5, borderColor: '#334155', color: 'text.secondary' }}
          >
            Entendido
          </Button>
        )}

        {/* ENTRY SIGNAL — position already open (guard) */}
        {isEntrySignal && hasOpenPosition && (
          <Button
            variant="outlined"
            size="small"
            onClick={onDismiss}
            sx={{ fontSize: 11, py: 0.5, borderColor: '#334155', color: 'text.secondary' }}
          >
            Cerrar — ya hay posición abierta
          </Button>
        )}

        {/* EXIT SIGNAL or WARNING — siempre informativo: el motor decide
            autónomamente (TP/SL/Risk Manager). El usuario no aprueba ni cierra
            desde el popup. */}
        {isExitOrWarning && (
          <Button
            variant="outlined"
            size="small"
            onClick={onDismiss}
            sx={{ fontSize: 11, py: 0.5, borderColor: '#334155', color: 'text.secondary' }}
          >
            Entendido
          </Button>
        )}

        {/* INVALIDATED */}
        {isInvalidated && (
          <Button
            variant="outlined"
            size="small"
            onClick={onDismiss}
            sx={{ fontSize: 11, py: 0.5, borderColor: '#334155', color: 'text.secondary' }}
          >
            Entendido
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
