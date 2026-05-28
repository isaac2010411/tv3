import React from 'react';

/**
 * Main chart workspace.
 *
 * Candles remain the primary visualization.
 * Secondary analytics should appear as overlays or companion panels,
 * not hidden behind navigation whenever possible.
 */
export function ChartWorkspace({ children }) {
  return (
    <main className="dashboard-workspace dashboard-workspace--chart">
      {children}
    </main>
  );
}

export default ChartWorkspace;
