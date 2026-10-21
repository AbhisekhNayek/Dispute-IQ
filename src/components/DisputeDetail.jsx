import React from 'react';
import { money, pct, decide, generateEscalationBrief } from '../logic.js';
import EvidenceList from './EvidenceList.jsx';
import EscalationBrief from './EscalationBrief.jsx';
import DeadlineIndicator from './DeadlineIndicator.jsx';

const capitalize = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '');

/**
 * Clean, modern Dispute Detail view.
 * The Expected Recovery vs. Cost comparison is the central hero visual.
 *
 * @param {{
 *   dispute: Object,
 *   policy: Object,
 *   actioned: { act: string, by: string, timestamp: string } | undefined,
 *   onAction: (disputeId: string, action: 'accept'|'challenge', actor: 'agent'|'human') => void,
 *   onViewTrace?: () => void
 * }} props
 */
export default function DisputeDetail({
  dispute,
  policy,
  actioned,
  onAction,
  onViewTrace,
}) {
  if (!dispute) {
    return (
      <section className="card detail-card empty-state mu">
        <p>Select a dispute to view assessment.</p>
      </section>
    );
  }

  const decision = decide(dispute, policy);
  const escalationBrief =
    decision.out === 'ESCALATE' ? generateEscalationBrief(dispute, policy) : null;

  // Scale normalization
  const maxScale = Math.max(decision.ev, decision.th, 1);
  const evPercent = Math.min(100, Math.max(0, (decision.ev / maxScale) * 100));
  const thPercent = Math.min(100, Math.max(0, (decision.th / maxScale) * 100));
  const netAdvantage = decision.ev - decision.th;
  const isProfitable = netAdvantage > 0;

  return (
    <div className="detail-view">
      {/* ── Top Header ── */}
      <section className="card detail-header-card">
        <div className="detail-header-top">
          <div>
            <div className="dispute-id-badge mono">{dispute.id}</div>
            <h1 className="dispute-headline">{dispute.t}</h1>
            <p className="dispute-note">{dispute.n}</p>
          </div>
          <div className="detail-header-right">
            <span className="dispute-amount mono">{money(dispute.a)}</span>
            <DeadlineIndicator days={dispute.d} />
          </div>
        </div>
      </section>

      {/* ── HERO VISUAL: Economic Decision Model ── */}
      <section className="card hero-card" aria-label="Economic Decision Model">
        <div className="hero-top-row">
          <div className="verdict-banner">
            <span className={`verdict-pill ${decision.out}`}>
              {capitalize(decision.out)}
            </span>
            <span className="verdict-subtext">
              {decision.why[0]}
            </span>
          </div>
        </div>

        {/* 3 Key Financial Metrics */}
        <div className="hero-metrics-grid">
          <div className="metric-cell">
            <span className="metric-cell-label mu">Win Probability</span>
            <span className="metric-cell-val mono">{pct(decision.p)}</span>
          </div>
          <div className="metric-cell">
            <span className="metric-cell-label mu">Confidence Score</span>
            <span className="metric-cell-val mono">{pct(decision.c)}</span>
          </div>
          <div className="metric-cell">
            <span className="metric-cell-label mu">Expected Net Gain</span>
            <span
              className={`metric-cell-val mono ${
                isProfitable ? 'gain-positive' : 'gain-negative'
              }`}
            >
              {money(netAdvantage)}
            </span>
          </div>
        </div>

        {/* Visual Bar Comparison: Recovery vs Cost */}
        <div className="hero-bars-container">
          <div className="hero-bar-row">
            <div className="bar-labels">
              <span className="bar-title">Expected Recovery (p × amount)</span>
              <span className="mono bar-amount text-teal">{money(decision.ev)}</span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-valuenow={Math.round(decision.ev)}
              aria-label={`Expected recovery ${money(decision.ev)}`}
            >
              <div
                className="progress-fill fill-teal"
                style={{ width: `${evPercent}%` }}
              />
            </div>
          </div>

          <div className="hero-bar-row">
            <div className="bar-labels">
              <span className="bar-title">
                Cost Threshold (${policy.cost} × {policy.margin.toFixed(1)}×)
              </span>
              <span className="mono bar-amount text-orange">{money(decision.th)}</span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-valuenow={Math.round(decision.th)}
              aria-label={`Cost threshold ${money(decision.th)}`}
            >
              <div
                className="progress-fill fill-orange"
                style={{ width: `${thPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Button & Confirmation */}
        <div className="hero-action-row">
          {actioned ? (
            <div className="action-completed-box">
              <div className="action-completed-header">
                <span className="action-badge">✓ Dispute {capitalize(actioned.act)}ed</span>
                <span className="mu action-meta">
                  by {actioned.by} · {new Date(actioned.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <pre className="mono dryrun-code">
{`POST /api/v1/pa/payment_disputes/${dispute.id}/${actioned.act}
// Dry-run simulator. Nothing was sent to Airwallex.`}
              </pre>
            </div>
          ) : decision.out === 'ESCALATE' ? (
            <div className="action-btn-group">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onAction(dispute.id, 'challenge', 'human')}
              >
                Approve as Challenge (Human)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onAction(dispute.id, 'accept', 'human')}
              >
                Approve as Accept (Concede)
              </button>
            </div>
          ) : (
            <div className="action-btn-group">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  onAction(dispute.id, decision.out.toLowerCase(), 'agent')
                }
              >
                Execute {capitalize(decision.out)} (Dry Run)
              </button>
            </div>
          )}

          {onViewTrace && (
            <button
              type="button"
              className="btn-link view-trace-link"
              onClick={onViewTrace}
            >
              Inspect formula & decision trace →
            </button>
          )}
        </div>
      </section>

      {/* ── Escalation Brief (if flagged) ── */}
      {escalationBrief && (
        <section className="card escalation-card">
          <EscalationBrief brief={escalationBrief} />
        </section>
      )}

      {/* ── Supporting Evidence ── */}
      <section className="card evidence-card">
        <EvidenceList evidence={dispute.ev} />
      </section>
    </div>
  );
}
