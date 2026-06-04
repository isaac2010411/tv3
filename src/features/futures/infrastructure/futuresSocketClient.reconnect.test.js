import { io } from 'socket.io-client'
import { subscribeSymbol, onConnectionChange, destroySocket } from './futuresSocketClient'

jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}))

describe('futuresSocketClient reconnect checks', () => {
  let mockSocket
  let handlers

  beforeEach(() => {
    handlers = {}
    mockSocket = {
      connected: false,
      id: 'socket-1',
      emit: jest.fn(),
      on: jest.fn((event, cb) => {
        handlers[event] = cb
      }),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
      disconnect: jest.fn(),
      listeners: jest.fn(() => []),
    }
    io.mockReturnValue(mockSocket)
    localStorage.clear()
  })

  afterEach(() => {
    destroySocket()
    jest.clearAllMocks()
  })

  test('creates socket with reconnection enabled and expected policy', () => {
    subscribeSymbol('BTCUSDT', ['1m'])

    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      }),
    )
  })

  test('onConnectionChange propagates connect lifecycle for reconnect handling', () => {
    const states = []

    const cleanup = onConnectionChange((status) => states.push(status))

    handlers.connect()
    handlers.disconnect()
    handlers.connect_error()

    expect(states).toEqual(['connected', 'disconnected', 'connecting'])

    cleanup()
    expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function))
    expect(mockSocket.off).toHaveBeenCalledWith('disconnect', expect.any(Function))
    expect(mockSocket.off).toHaveBeenCalledWith('connect_error', expect.any(Function))
  })
})
