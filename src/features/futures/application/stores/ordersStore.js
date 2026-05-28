/**
 * ordersStore
 *
 * Account-level orders state. Indexed by orderId. Open orders are tracked
 * separately to avoid scanning the full map on every render.
 */
import { create } from 'zustand'

const TERMINAL_STATUSES = new Set(['FILLED', 'CANCELED', 'REJECTED'])

export const useOrdersStore = create((set) => ({
  ordersById: {},
  openOrderIds: [],

  setOrders(orders) {
    const list = Array.isArray(orders) ? orders : []
    const ordersById = {}
    const openOrderIds = []
    for (const o of list) {
      if (!o?.orderId) continue
      ordersById[o.orderId] = o
      if (!TERMINAL_STATUSES.has(o.status)) openOrderIds.push(o.orderId)
    }
    set({ ordersById, openOrderIds })
  },

  upsertOrder(order) {
    if (!order?.orderId) return
    set((s) => {
      const ordersById = { ...s.ordersById, [order.orderId]: order }
      const isOpen = !TERMINAL_STATUSES.has(order.status)
      const wasOpen = s.openOrderIds.includes(order.orderId)
      let openOrderIds = s.openOrderIds
      if (isOpen && !wasOpen) openOrderIds = [order.orderId, ...s.openOrderIds]
      else if (!isOpen && wasOpen) openOrderIds = s.openOrderIds.filter((id) => id !== order.orderId)
      return { ordersById, openOrderIds }
    })
  },

  applyLifecycle(event) {
    if (!event?.orderId) return
    set((s) => {
      const prev = s.ordersById[event.orderId] || {}
      const merged = { ...prev, ...event }
      const ordersById = { ...s.ordersById, [event.orderId]: merged }
      const isOpen = !TERMINAL_STATUSES.has(merged.status)
      const wasOpen = s.openOrderIds.includes(event.orderId)
      let openOrderIds = s.openOrderIds
      if (isOpen && !wasOpen) openOrderIds = [event.orderId, ...s.openOrderIds]
      else if (!isOpen && wasOpen) openOrderIds = s.openOrderIds.filter((id) => id !== event.orderId)
      return { ordersById, openOrderIds }
    })
  },

  reset() {
    set({ ordersById: {}, openOrderIds: [] })
  },
}))

export const selectAllOrders = (s) => Object.values(s.ordersById)
export const selectOpenOrders = (s) => s.openOrderIds.map((id) => s.ordersById[id]).filter(Boolean)
export const selectOrderById = (id) => (s) => s.ordersById[id] || null
