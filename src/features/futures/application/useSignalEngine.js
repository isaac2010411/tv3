/**
 * useSignalEngine
 *
 * Thin React hook that listens to `futures:signal:update` events emitted by
 * the backend's StateMachineSignalEngine.
 *
 * The backend is the source of truth for the state machine and positions.
 * This hook only:
 *  - Reads the latest signal update from the realtime slice
 *  - Reads open position state from the backend-fed paper trade store
 *  - Manages popup state for signal notifications
 *  - Tracks rejected signal IDs to avoid re-showing dismissed signals
 *  - Sends position commands to the backend via socket
 *
 * No market computation happens here.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMarketDataStore, selectMarkPriceBySymbol } from './stores/marketDataStore'
import { useOrderBookStore, selectTopOfBookBySymbol } from './stores/orderBookStore'
import { useSignalStore, selectSignalUpdateBySymbol } from './stores/signalStore'
import { usePaperTradeStore, selectOpenPaperPositionsBySymbol } from './stores/paperTradeStore'
import { FUTURES_SOCKET_COMMANDS } from '../infrastructure/futuresSocketEvents'
import { emitCommand } from '../infrastructure/futuresSocketClient'
import { SIGNAL_STATES, ENTRY_SIGNAL_STATES } from '../domain/signalEngine/signalEngineStates'

// States that trigger the signal popup
const POPUP_TRIGGER_STATES = new Set([
  SIGNAL_STATES.LONG_ENTRY_SIGNAL,
  SIGNAL_STATES.SHORT_ENTRY_SIGNAL,
  SIGNAL_STATES.LONG_EXIT_SIGNAL,
  SIGNAL_STATES.SHORT_EXIT_SIGNAL,
  SIGNAL_STATES.LONG_EXIT_WARNING,
  SIGNAL_STATES.SHORT_EXIT_WARNING,
  SIGNAL_STATES.INVALIDATED,
])

const POPUP_AUTO_CLOSE_MS = 3_000

const DEFAULT_ENGINE_RESULT = Object.freeze({
  state: SIGNAL_STATES.IDLE,
  prevState: null,
  stateChanged: false,
  netScore: 0,
  confidence: 0,
  signal: null,
  activeSignal: null,
  hasPosition: false,
  positionDirection: null,
  reasons: [],
  missingContext: [],
})

/**
 * @param {string} symbol   - active trading symbol
 * @param {string} [_interval='1m'] - unused (kept for API compat; interval is server-side)
 * @returns {{
 *   engineResult: object,
 *   position: object|null,
 *   hasOpenPosition: boolean,
 *   currentPrice: number|null,
 *   isPopupOpen: boolean,
 *   popupSignal: object|null,
 *   popupState: string|null,
 *   acceptSignal: Function,
 *   rejectSignal: Function,
 *   closePosition: Function,
 *   acceptExitSignal: Function,
 *   dismissPopup: Function,
 * }}
 */
export function useSignalEngine(symbol, _interval = '1m') {
  const signalUpdate = useSignalStore(selectSignalUpdateBySymbol(symbol))
  const markPrice = useMarketDataStore(selectMarkPriceBySymbol(symbol))
  const topOfBook = useOrderBookStore(selectTopOfBookBySymbol(symbol))

  // Latest backend engine result from socket events
  const engineResult = signalUpdate ?? DEFAULT_ENGINE_RESULT

  // Current price from the mark price or top of book (for PnL display)
  const currentPrice = useMemo(() => {
    const mp = markPrice?.markPrice
    if (mp != null) return parseFloat(mp)
    const mid = topOfBook?.midPrice
    if (mid != null) return parseFloat(mid)
    return null
  }, [markPrice, topOfBook])

  const openPaperPositions = usePaperTradeStore(selectOpenPaperPositionsBySymbol(symbol))

  // Backend is the only source of truth for open positions.
  const position = useMemo(() => {
    return openPaperPositions[0] ?? null
  }, [openPaperPositions])

  const hasOpenPosition = position !== null && position.status === 'OPEN'

  // Track whether the user has engaged with a signal this session, to guard
  // spurious INVALIDATED popups that arrive on reconnect before any signal was shown.
  const hadEngagedRef = useRef(false)

  // Popup state
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [popupSignal, setPopupSignal] = useState(null)
  const [popupState, setPopupState] = useState(null)
  const [popupAutoExecution, setPopupAutoExecution] = useState(null)

  // Refs to avoid stale closures in popup trigger effect
  const rejectedSignalIdsRef = useRef(new Set())
  const lastShownSignalIdRef = useRef(null)
  const hasOpenPositionRef = useRef(false)

  // Keep ref in sync with state
  hasOpenPositionRef.current = hasOpenPosition

  // Reset popup and refs when symbol changes
  useEffect(() => {
    setIsPopupOpen(false)
    setPopupSignal(null)
    setPopupState(null)
    setPopupAutoExecution(null)
    rejectedSignalIdsRef.current = new Set()
    lastShownSignalIdRef.current = null
    hadEngagedRef.current = false
  }, [symbol])

  // Reset duplicate-signal guard when backend reports no open positions.
  useEffect(() => {
    if (openPaperPositions.length > 0) return
    lastShownSignalIdRef.current = null
  }, [openPaperPositions])

  // Popup trigger: watch engine state for actionable signals
  useEffect(() => {
    const { state, stateChanged, activeSignal, autoExecution } = engineResult

    if (!POPUP_TRIGGER_STATES.has(state)) return

    // INVALIDATED: only show if the user engaged with a signal this session.
    // On reconnect the backend may emit INVALIDATED immediately (state machine
    // running since before the reload) - don't pop up in that case.
    if (state === SIGNAL_STATES.INVALIDATED) {
      if (stateChanged && hadEngagedRef.current) {
        setPopupSignal(null)
        setPopupState(SIGNAL_STATES.INVALIDATED)
        setPopupAutoExecution(autoExecution ?? null)
        setIsPopupOpen(true)
      }
      return
    }

    if (!activeSignal) return

    // Don't re-show a previously rejected signal
    if (rejectedSignalIdsRef.current.has(activeSignal.id)) return

    // Don't re-show the same signal twice
    if (lastShownSignalIdRef.current === activeSignal.id) return

    // For entry signals: don't open popup if a position is already open
    if (ENTRY_SIGNAL_STATES.has(state) && hasOpenPositionRef.current) return

    hadEngagedRef.current = true
    lastShownSignalIdRef.current = activeSignal.id
    setPopupSignal(activeSignal)
    setPopupState(state)
    setPopupAutoExecution(autoExecution ?? null)
    setIsPopupOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineResult.state, engineResult.stateChanged, engineResult.activeSignal?.id, engineResult.autoExecution?.mode])

  // Auto-close signal popups quickly so they never remain on screen too long.
  useEffect(() => {
    if (!isPopupOpen) return undefined

    const timeoutId = window.setTimeout(() => {
      setIsPopupOpen(false)
      setPopupSignal(null)
      setPopupState(null)
      setPopupAutoExecution(null)
    }, POPUP_AUTO_CLOSE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [isPopupOpen, popupSignal?.id, popupState])

  // Accept: close popup, notify backend (no local optimistic position)
  const acceptSignal = useCallback(() => {
    // Use popupState (captured when popup opened), NOT the live engineResult.state.
    // The backend may have advanced past ENTRY_SIGNAL by the time the user clicks.
    const state = popupState
    if (state !== SIGNAL_STATES.LONG_ENTRY_SIGNAL && state !== SIGNAL_STATES.SHORT_ENTRY_SIGNAL) return

    // Risk Manager already executed this signal autonomously - the popup is
    // informational only; do not re-send an accept command (would violate the
    // 1-op-per-asset rule on the backend).
    if (popupAutoExecution?.mode === 'AUTO' && popupAutoExecution?.approved) {
      setIsPopupOpen(false)
      setPopupSignal(null)
      setPopupState(null)
      setPopupAutoExecution(null)
      return
    }

    const direction = state === SIGNAL_STATES.LONG_ENTRY_SIGNAL ? 'LONG' : 'SHORT'
    // Prefer the signal captured when popup opened; otherwise use live signal.
    const signal = popupSignal ?? engineResult.activeSignal ?? engineResult.signal
    const signalId = signal?.id ?? null
    const signalDirection = typeof signal?.direction === 'string' ? signal.direction.toUpperCase() : direction
    const quantity = signal?.risk?.quantity ?? signal?.risk?.positionSize ?? null

    hadEngagedRef.current = true
    setIsPopupOpen(false)
    setPopupSignal(null)
    setPopupState(null)
    setPopupAutoExecution(null)

    emitCommand(FUTURES_SOCKET_COMMANDS.SIGNAL_POSITION_ACCEPT, {
      symbol,
      signalId,
      direction: signalDirection,
      signalState: state,
      entryPrice: signal?.risk?.entryPrice ?? null,
      stopLoss: signal?.risk?.stopLoss ?? null,
      takeProfit: signal?.risk?.takeProfit ?? null,
      quantity,
    })
  }, [symbol, popupState, popupSignal, popupAutoExecution, engineResult])

  // Reject: add to rejected IDs, close popup, trigger backend COOLDOWN
  const rejectSignal = useCallback(() => {
    if (popupSignal?.id) {
      rejectedSignalIdsRef.current = new Set([...rejectedSignalIdsRef.current, popupSignal.id])
    }
    setIsPopupOpen(false)
    setPopupSignal(null)
    setPopupState(null)
    setPopupAutoExecution(null)
    emitCommand(FUTURES_SOCKET_COMMANDS.SIGNAL_POSITION_CLOSE, { symbol })
  }, [symbol, popupSignal])

  // Close position: close popup and notify backend
  const closePosition = useCallback(() => {
    setIsPopupOpen(false)
    setPopupSignal(null)
    setPopupState(null)
    setPopupAutoExecution(null)
    emitCommand(FUTURES_SOCKET_COMMANDS.SIGNAL_POSITION_CLOSE, { symbol })
  }, [symbol])

  // Accept exit signal: same as closePosition but named for clarity
  const acceptExitSignal = useCallback(() => {
    closePosition()
  }, [closePosition])

  // Dismiss popup without acting on the signal
  const dismissPopup = useCallback(() => {
    setIsPopupOpen(false)
    setPopupSignal(null)
    setPopupState(null)
    setPopupAutoExecution(null)
  }, [])

  return {
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
  }
}
