import React from 'react';
import { money } from '../logic.js';

/**
 * Session audit log tracking every automated and human decision action.
 * Supports exporting the session audit trail as a formatted JSON document.
 *
 * @param {{
 *   logs: Array<{
 *     timestamp: string,
 *     disputeId: string,
 *     action: string,
 *     actor: 'agent'|'human',
 *     policySnapshot: { cost: number, margin: number, limit: number, conf: number },
 *     simulated?: boolean
 *   }>,
 *   onExport: () => void,
 *   onClear: () => void
 * }} props
 */
export default function AuditLog({ logs = [], onExport, onClear }) {
  return (
    <section className="card" aria-labelledby="audit-log-heading">
      <div className="section-header">
        <h2 id="audit-log-heading">Audit Trail ({logs.length})</h2>
        <div className="audit-actions">
          {logs.length > 0 && (
            <>
              <button
                type="button"
                className="chip"
                onClick={onExport}
                title="Download complete audit log as JSON"
              >
                Export as JSON
              </button>
              <button
                type="button"
                className="chip chip-subtle"
                onClick={onClear}
                title="Clear current session log"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      <ul className="log" role="list">
        {logs.length > 0 ? (
          logs.map((l, idx) => (
            <li className="mono log-item" key={`${l.timestamp}-${idx}`}>
              <div className="log-item-header">
                <span className="log-time">{new Date(l.timestamp).toLocaleTimeString()}</span>
                <span className="log-id">{l.disputeId}</span>
                <span className={`log-actor tag ${l.action.toUpperCase()}`}>
                  {l.action} by {l.actor}
                </span>
              </div>
              <div className="log-item-policy mu">
                policy: cost {money(l.policySnapshot.cost)}, margin {l.policySnapshot.margin.toFixed(1)}×, limit {money(l.policySnapshot.limit)}, conf {l.policySnapshot.conf}%
                {l.simulated && ' · [Dry Run]'}
              </div>
            </li>
          ))
        ) : (
          <li className="mu log-empty">
            No actions recorded yet. Run a decision or approve an escalation to record it here.
          </li>
        )}
      </ul>
    </section>
  );
}
