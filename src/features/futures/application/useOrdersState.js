import { useEffect } from 'react'
import { useOrdersStore } from './stores/ordersStore'
import { fetchOpenOrdersAll } from '../infrastructure/futuresApiClient'
import { onEvent, offEvent } from '../infrastructure/futuresSocketClient'
import { FUTURES_SOCKET_EVENTS } from '../infrastructure/futuresSocketEvents'

/**
 * Loads open orders once and subscribes to ORDER_LIFECYCLE events.
 */
export function useOrdersState() {
  const setOrders = useOrdersStore((s) => s.setOrders)
  const applyLifecycle = useOrdersStore((s) => s.applyLifecycle)

  useEffect(() => {
    let cancelled = false
    fetchOpenOrdersAll()
      .then((orders) => { if (!cancelled) setOrders(orders) })
      .catch((err) => console.warn('[useOrdersState] fetchOpenOrdersAll failed', err))
    return () => { cancelled = true }
  }, [setOrders])

  useEffect(() => {
    const handler = (evt) => applyLifecycle(evt)
    onEvent(FUTURES_SOCKET_EVENTS.ORDER_LIFECYCLE, handler)
    return () => offEvent(FUTURES_SOCKET_EVENTS.ORDER_LIFECYCLE, handler)
  }, [applyLifecycle])
}
