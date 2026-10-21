import React from 'react';

/**
 * Clean, modern human investigator brief for escalated disputes.
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
    <div className="escalation-brief-inner" role="region" aria-label="Human Review Brief">
      <div className="brief-header">
        <span className="badge-alert">Escalation Triggered</span>
        <h3 className="brief-title">Human Review Brief</h3>
      </div>

      <p className="brief-summary">{brief.summary}</p>

      <div className="brief-cards-grid">
        <div className="brief-box">
          <span className="brief-kicker">Key Evidence Factors</span>
          <div className="brief-evidence-row">
            <span className="factor-label mu">Strongest:</span>
            <span className="factor-val text-teal">{brief.strongestEvidence || 'None'}</span>
          </div>
          <div className="brief-evidence-row">
            <span className="factor-label mu">Weakest:</span>
            <span className="factor-val text-orange">{brief.weakestEvidence || 'None'}</span>
          </div>
        </div>

        <div className="brief-box">
          <span className="brief-kicker">Recommended Action</span>
          <p className="brief-recommendation-text">{brief.recommendedAction}</p>
          {brief.missingEvidence && brief.missingEvidence.length > 0 && (
            <div className="brief-missing-hint mu">
              Missing evidence: {brief.missingEvidence.join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
