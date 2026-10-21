import React from 'react';
import { money, decide } from '../logic.js';
import DeadlineIndicator from './DeadlineIndicator.jsx';

const capitalize = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '');

/**
 * Clean, compact queue of open disputes.
 *
 * @param {{
 *   disputes: Array,
 *   policy: Object,
 *   selectedIndex: number,
 *   onSelect: (index: number) => void,
 *   actionedDisputes: Object
 * }} props
 */
export default function DisputeQueue({
  disputes = [],
  policy,
  selectedIndex,
  onSelect,
  actionedDisputes = {},
}) {
  if (!disputes.length) {
    return (
      <section className="card" aria-labelledby="queue-heading">
        <h2 id="queue-heading" className="card-title">Disputes</h2>
        <div className="empty-state mu">
          <p>No open disputes.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card queue-card" aria-labelledby="queue-heading">
      <div className="section-header">
        <h2 id="queue-heading" className="card-title">Open Disputes</h2>
        <span className="count-badge">{disputes.length}</span>
      </div>

      <div className="queue-list" role="list">
        {disputes.map((dispute, index) => {
          const decision = decide(dispute, policy);
          const isSelected = index === selectedIndex;
          const actioned = actionedDisputes[dispute.id];

          return (
            <button
              key={dispute.id}
              type="button"
              role="listitem"
              className={`queue-item ${isSelected ? 'active' : ''}`}
              onClick={() => onSelect(index)}
              aria-current={isSelected ? 'true' : 'false'}
            >
              <div className="queue-item-top">
                <span className="queue-item-title">{dispute.t}</span>
                <span className={`tag ${decision.out}`}>
                  {capitalize(decision.out)}
                </span>
              </div>
              <div className="queue-item-bottom">
                <span className="mono queue-item-amount">{money(dispute.a)}</span>
                <div className="queue-item-tags">
                  <DeadlineIndicator days={dispute.d} />
                  {actioned && (
                    <span className="actioned-pill" title={`Completed: ${actioned.act}`}>
                      ✓ {actioned.act}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
