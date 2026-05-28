import { useEffect } from 'react'
import { useRiskStore } from './stores/riskStore'
import { fetchRiskLimits } from '../infrastructure/futuresApiClient'
import { onEvent, offEvent } from '../infrastructure/futuresSocketClient'
import { FUTURES_SOCKET_EVENTS } from '../infrastructure/futuresSocketEvents'

export function useRiskState() {
  const setLimits = useRiskStore((s) => s.setLimits)
  const pushDecision = useRiskStore((s) => s.pushDecision)

  useEffect(() => {
    let cancelled = false
    fetchRiskLimits()
      .then((limits) => { if (!cancelled) setLimits(limits) })
      .catch((err) => console.warn('[useRiskState] fetchRiskLimits failed', err))
    return () => { cancelled = true }
  }, [setLimits])

  useEffect(() => {
    const handler = (decision) => pushDecision(decision)
    onEvent(FUTURES_SOCKET_EVENTS.RISK_DECISION, handler)
    return () => offEvent(FUTURES_SOCKET_EVENTS.RISK_DECISION, handler)
  }, [pushDecision])
}
