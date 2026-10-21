import React from 'react';
import { pct } from '../logic.js';

/**
 * Clean, compact evidence list showing strength, confidence, and field category.
 * Avoids visual clutter from redundant progress bars on every single item.
 *
 * @param {{ evidence: Array<[string, number, number, number, string]> }} props
 */
export default function EvidenceList({ evidence = [] }) {
  if (!evidence.length) {
    return (
      <div className="empty-state mu">
        <p>No supporting evidence provided.</p>
      </div>
    );
  }

  // Friendly human-readable category name
  const formatField = (field) => {
    return field
      .replace(/_file_ids$/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="evidence-section" aria-label="Supporting evidence">
      <div className="evidence-header">
        <h3 className="section-subtitle">Supporting Evidence ({evidence.length})</h3>
        <span className="mu evidence-note">Pre-scored by deterministic rule engine</span>
      </div>

      <div className="evidence-list" role="list">
        {evidence.map(([name, strength, confidence, weight, fieldId]) => {
          return (
            <div className="evidence-item" key={`${name}-${fieldId}`} role="listitem">
              <div className="evidence-main">
                <span className="evidence-name">{name}</span>
                <span className="evidence-category">{formatField(fieldId)}</span>
              </div>
              <div className="evidence-metrics">
                <span
                  className="metric-pill metric-strength"
                  title={`Weight: ${weight}×`}
                >
                  {pct(strength)} strength
                </span>
                <span
                  className="metric-pill metric-conf"
                  title="Grader model confidence"
                >
                  {pct(confidence)} conf
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
