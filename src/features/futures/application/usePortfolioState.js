import { useEffect } from 'react'
import { usePortfolioStore } from './stores/portfolioStore'
import {
  fetchPortfolioSnapshot,
  fetchPortfolioExposure,
  fetchPortfolioPerformance,
} from '../infrastructure/futuresApiClient'
import { onEvent, offEvent } from '../infrastructure/futuresSocketClient'
import { FUTURES_SOCKET_EVENTS } from '../infrastructure/futuresSocketEvents'

export function usePortfolioState() {
  const applySnapshot = usePortfolioStore((s) => s.applySnapshot)
  const setExposure = usePortfolioStore((s) => s.setExposure)
  const setPerformance = usePortfolioStore((s) => s.setPerformance)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchPortfolioSnapshot().catch(() => null),
      fetchPortfolioExposure().catch(() => null),
      fetchPortfolioPerformance().catch(() => null),
    ]).then(([snap, exp, perf]) => {
      if (cancelled) return
      if (snap) applySnapshot(snap)
      if (exp) setExposure(exp)
      if (perf) setPerformance(perf)
    })
    return () => { cancelled = true }
  }, [applySnapshot, setExposure, setPerformance])

  useEffect(() => {
    const handler = (snapshot) => applySnapshot(snapshot)
    onEvent(FUTURES_SOCKET_EVENTS.PORTFOLIO_SNAPSHOT, handler)
    return () => offEvent(FUTURES_SOCKET_EVENTS.PORTFOLIO_SNAPSHOT, handler)
  }, [applySnapshot])
}
