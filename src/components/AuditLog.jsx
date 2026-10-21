import React from 'react';
import { money } from '../logic.js';

/**
 * Clean session Audit Log panel with JSON export.
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
    <div className="audit-view">
      <section className="card">
        <div className="section-header">
          <div>
            <h2 className="card-title">Session Audit Trail</h2>
            <span className="mu card-subtitle">
              {logs.length} logged decision{logs.length === 1 ? '' : 's'} in current session
            </span>
          </div>
          <div className="audit-btns">
            {logs.length > 0 && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onExport}
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  className="btn-link text-muted"
                  onClick={onClear}
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        {logs.length > 0 ? (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Dispute ID</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Policy Snapshot</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l, idx) => (
                  <tr key={`${l.timestamp}-${idx}`}>
                    <td className="mono mu">{new Date(l.timestamp).toLocaleTimeString()}</td>
                    <td className="mono font-semibold">{l.disputeId}</td>
                    <td>
                      <span className={`tag ${l.action.toUpperCase()}`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="mu">{l.actor}</td>
                    <td className="mono mu text-xs">
                      cost {money(l.policySnapshot.cost)}, {l.policySnapshot.margin.toFixed(1)}×, limit {money(l.policySnapshot.limit)}, conf {l.policySnapshot.conf}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state mu">
            <p>No actions logged yet in this session. Run an action to record it here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
