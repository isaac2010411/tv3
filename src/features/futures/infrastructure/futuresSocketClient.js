import { io } from 'socket.io-client'
import { FUTURES_SOCKET_COMMANDS } from './futuresSocketEvents'

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000'
const ALLOW_POLLING_FALLBACK = String(process.env.REACT_APP_SOCKET_ALLOW_POLLING || '').toLowerCase() === 'true'

let socket = null

function buildSocketAuth() {
  const token = localStorage.getItem('authToken')

  if (!token) {
    return undefined
  }

  return {
    token,
  }
}

function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ALLOW_POLLING_FALLBACK ? ['websocket', 'polling'] : ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000,
      auth: buildSocketAuth(),
    })
  }

  return socket
}

/**
 * Subscribes to realtime updates for a symbol.
 *
 * Callers must pass the intervals (and optional feature set) explicitly —
 * there are no hard-coded defaults. The active intervals/features come from
 * `subscriptionPlanStore` via `useSocketSubscriptionSync`.
 *
 * @param {string}   symbol
 * @param {string[]} intervals
 * @param {{ features?: string[] }} [opts]
 */
export function subscribeSymbol(symbol, intervals, opts = {}) {
  if (!symbol) return
  if (!Array.isArray(intervals) || intervals.length === 0) {
    // Defensive: never emit a default interval set. Force callers to be explicit.
    // eslint-disable-next-line no-console
    console.warn('[futuresSocketClient] subscribeSymbol called without intervals; skipping', { symbol })
    return
  }
  const payload = { symbol, intervals }
  if (Array.isArray(opts.features) && opts.features.length > 0) {
    payload.features = opts.features
  }
  getSocket().emit(FUTURES_SOCKET_COMMANDS.SUBSCRIBE_ASSET, payload)
}

/**
 * Unsubscribes from realtime updates for a symbol.
 * @param {string} symbol
 */
export function unsubscribeSymbol(symbol) {
  getSocket().emit(FUTURES_SOCKET_COMMANDS.UNSUBSCRIBE_ASSET, {
    symbol,
  })
}

/**
 * Attaches a listener to a socket event.
 * @param {string} event
 * @param {Function} handler
 */
export function onEvent(event, handler) {
  getSocket().on(event, handler)
}

/**
 * Removes a socket event listener.
 * @param {string} event
 * @param {Function} handler
 */
export function offEvent(event, handler) {
  getSocket().off(event, handler)
}

/**
 * Emits a command to the server.
 * @param {string} command
 * @param {object} [data]
 */
export function emitCommand(command, data) {
  getSocket().emit(command, data ?? {})
}

/**
 * Returns the current connection status.
 * @returns {'connected'|'disconnected'|'connecting'}
 */
export function getConnectionStatus() {
  if (!socket) return 'disconnected'
  if (socket.connected) return 'connected'
  return 'connecting'
}

/**
 * Registers handlers for connection state changes.
 * @param {Function} handler receives connection state
 * @returns {Function} cleanup
 */
export function onConnectionChange(handler) {
  const s = getSocket()

  const onConnect = () => handler('connected')
  const onDisconnect = () => handler('disconnected')
  const onConnectError = () => handler('connecting')

  s.on('connect', onConnect)
  s.on('disconnect', onDisconnect)
  s.on('connect_error', onConnectError)

  return () => {
    s.off('connect', onConnect)
    s.off('disconnect', onDisconnect)
    s.off('connect_error', onConnectError)
  }
}

/**
 * Phase 5.6 — Tear down the singleton socket. Removes all listeners and
 * disconnects. Subsequent calls to `getSocket()` will create a fresh socket.
 * Intended for HMR boundaries and explicit session teardown.
 */
export function destroySocket() {
  if (!socket) return
  try {
    socket.removeAllListeners()
    socket.disconnect()
  } catch {
    /* ignore */
  }
  socket = null
}
