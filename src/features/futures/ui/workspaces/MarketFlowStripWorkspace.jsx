import React from 'react';

/**
 * Horizontal strip for market flow confirmation.
 *
 * This area should remain visible while trading and contain:
 * - tape reader
 * - CVD
 * - spoofing alerts
 * - liquidity shifts
 * - compact positions/orders
 */
export function MarketFlowStripWorkspace({ children }) {
  return (
    <section className="dashboard-workspace dashboard-workspace--market-flow-strip">
      {children}
    </section>
  );
}

export default MarketFlowStripWorkspace;
