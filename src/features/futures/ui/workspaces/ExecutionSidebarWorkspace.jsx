import React from 'react';

/**
 * Workspace dedicated to execution and risk visibility.
 *
 * Priority content:
 * - trade ticket
 * - validation state
 * - leverage / margin snapshot
 * - trading rules
 * - paper/live mode visibility
 */
export function ExecutionSidebarWorkspace({ children }) {
  return (
    <aside className="dashboard-workspace dashboard-workspace--execution-sidebar">
      {children}
    </aside>
  );
}

export default ExecutionSidebarWorkspace;
