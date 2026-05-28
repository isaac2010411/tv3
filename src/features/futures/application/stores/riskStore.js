/**
 * riskStore
 *
 * Risk Manager state — current account limits and recent decisions stream.
 */
import { create } from 'zustand'

const MAX_DECISIONS = 50

export const useRiskStore = create((set) => ({
  limits: null,
  lastDecision: null,
  recentDecisions: [],

  setLimits(limits) {
    set({ limits: limits || null })
  },

  pushDecision(decision) {
    if (!decision) return
    const enriched = { ...decision, receivedAt: decision.receivedAt || Date.now() }
    set((s) => ({
      lastDecision: enriched,
      recentDecisions: [enriched, ...s.recentDecisions].slice(0, MAX_DECISIONS),
    }))
  },

  clearLastDecision() {
    set({ lastDecision: null })
  },

  reset() {
    set({ limits: null, lastDecision: null, recentDecisions: [] })
  },
}))

export const selectRiskLimits = (s) => s.limits
export const selectLastRiskDecision = (s) => s.lastDecision
export const selectRecentRiskDecisions = (s) => s.recentDecisions
