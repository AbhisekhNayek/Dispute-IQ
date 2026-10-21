import React from 'react';

/**
 * Human investigator brief rendered when a dispute is escalated.
 * Summarizes findings, highlights strongest/weakest evidence,
 * flags missing evidence categories, and provides an actionable recommendation.
 *
 * @param {{
 *   brief: {
 *     summary: string,
 *     strongestEvidence: string|null,
 *     weakestEvidence: string|null,
 *     missingEvidence: string[],
 *     recommendedAction: string
 *   }
 * }} props
 */
export default function EscalationBrief({ brief }) {
  if (!brief) return null;

  return (
    <div className="escalation-brief-card" role="region" aria-label="Human Review Brief">
      <div className="brief-header">
        <span className="brief-badge">Human Review Required</span>
        <h3 className="brief-title">Escalation Investigation Brief</h3>
      </div>

      <p className="brief-summary">{brief.summary}</p>

      <div className="brief-grid">
        <div className="brief-col">
          <h4 className="brief-subheading">Strongest Evidence</h4>
          <p className="brief-item positive">
            {brief.strongestEvidence || 'None available'}
          </p>

          <h4 className="brief-subheading">Weakest / Conflicting Evidence</h4>
          <p className="brief-item negative">
            {brief.weakestEvidence || 'None flagged'}
          </p>
        </div>

        <div className="brief-col">
          <h4 className="brief-subheading">Missing Recommended Evidence</h4>
          {brief.missingEvidence && brief.missingEvidence.length > 0 ? (
            <ul className="brief-missing-list">
              {brief.missingEvidence.map((type) => (
                <li key={type} className="mono">
                  • {type}
                </li>
              ))}
            </ul>
          ) : (
            <p className="brief-item">All standard evidence types present.</p>
          )}

          <h4 className="brief-subheading">Recommended Human Action</h4>
          <p className="brief-recommendation">
            👉 {brief.recommendedAction}
          </p>
        </div>
      </div>
    </div>
  );
}
