import React from 'react';

/**
 * Workspace container for high-priority market information.
 *
 * This header should always expose:
 * - selected symbol
 * - mark/last price
 * - 24h stats
 * - funding
 * - open interest
 * - connection status
 * - paper/live mode
 */
export function DashboardHeaderWorkspace({ children }) {
  return (
    <section className="dashboard-workspace dashboard-workspace--header">
      {children}
    </section>
  );
}

export default DashboardHeaderWorkspace;
