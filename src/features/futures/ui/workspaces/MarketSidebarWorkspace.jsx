import React from 'react';

/**
 * Workspace focused on immediate liquidity visibility.
 *
 * Priority content:
 * - order book
 * - imbalance
 * - spread
 * - liquidity walls
 * - top of book
 */
export function MarketSidebarWorkspace({ children }) {
  return (
    <aside className="dashboard-workspace dashboard-workspace--market-sidebar">
      {children}
    </aside>
  );
}

export default MarketSidebarWorkspace;
