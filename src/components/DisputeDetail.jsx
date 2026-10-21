import React from 'react';
import { money, pct, decide, flipHint, generateEscalationBrief } from '../logic.js';
import EvidenceList from './EvidenceList.jsx';
import DecisionTrace from './DecisionTrace.jsx';
import EscalationBrief from './EscalationBrief.jsx';
import DeadlineIndicator from './DeadlineIndicator.jsx';

const capitalize = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '');

/**
 * Detailed view of the currently selected dispute.
 * Features the expected-recovery vs. cost comparison as the hero visual.
 *
 * @param {{
 *   dispute: Object,
 *   policy: Object,
 *   actioned: { act: string, by: string, timestamp: string } | undefined,
 *   onAction: (disputeId: string, action: 'accept'|'challenge', actor: 'agent'|'human') => void
 * }} props
 */
export default function DisputeDetail({ dispute, policy, actioned, onAction }) {
  if (!dispute) {
    return (
      <section className="card">
        <p className="mu">Select a dispute from the queue to inspect details.</p>
      </section>
    );
  }

  const decision = decide(dispute, policy);
  const flipHintText = flipHint(dispute, policy);
  const escalationBrief = decision.out === 'ESCALATE' ? generateEscalationBrief(dispute, policy) : null;

  // Normalization for visual scale bar
  const maxScale = Math.max(decision.ev, decision.th, 1);
  const evPercent = Math.min(100, Math.max(0, (decision.ev / maxScale) * 100));
  const thPercent = Math.min(100, Math.max(0, (decision.th / maxScale) * 100));

  const isProfitable = decision.ev > decision.th;

  return (
    <section className="card detail-card" aria-labelledby="dispute-detail-heading">
      {/* Dispute Header */}
      <div className="head">
        <div>
          <h2 id="dispute-detail-heading" className="dispute-headline">{dispute.t}</h2>
          <div className="mu dispute-subline">
            <span className="mono">{dispute.id}</span> · {dispute.n}
          </div>
        </div>
        <div className="head-right">
          <div className="amt mono">{money(dispute.a)}</div>
          <DeadlineIndicator days={dispute.d} />
        </div>
      </div>

      {/* Supporting Evidence */}
      <EvidenceList evidence={dispute.ev} />

      {/* HERO VISUAL: Expected Recovery vs. Cost Comparison */}
      <div className="scale hero-scale" aria-label="Financial comparison: recovery vs cost">
        <div className="scale-title">
          <span className="hero-eyebrow">Financial Decision Model</span>
          <h3 className="hero-headline">Expected Recovery vs. Cost to Fight</h3>
        </div>

        <div className="stats">
          <div className="stat-box">
            <span className="stat-label mu">Win Probability (p)</span>
            <b className="stat-val mono">{pct(decision.p)}</b>
          </div>
          <div className="stat-box">
            <span className="stat-label mu">Evidence Confidence (c)</span>
            <b className="stat-val mono">{pct(decision.c)}</b>
          </div>
          <div className="stat-box">
            <span className="stat-label mu">Net Economic Margin</span>
            <b className={`stat-val mono ${isProfitable ? 'text-teal' : 'text-orange'}`}>
              {money(decision.ev - decision.th)}
            </b>
          </div>
        </div>

        <div className="scale-bars">
          <div className="scale-row">
            <div className="r">
              <span className="scale-label">
                <strong>Expected Recovery</strong> (p × amount)
              </span>
              <b className="mono scale-num text-teal">{money(decision.ev)}</b>
            </div>
            <div
              className="bar hero-bar"
              role="progressbar"
              aria-valuenow={Math.round(decision.ev)}
              aria-label={`Expected recovery: ${money(decision.ev)}`}
            >
              <i style={{ width: `${evPercent}%`, background: 'var(--tl)' }} />
            </div>
          </div>

          <div className="scale-row">
            <div className="r">
              <span className="scale-label">
                <strong>Cost Threshold</strong> (cost × safety margin {policy.margin.toFixed(1)}×)
              </span>
              <b className="mono scale-num text-orange">{money(decision.th)}</b>
            </div>
            <div
              className="bar hero-bar"
              role="progressbar"
              aria-valuenow={Math.round(decision.th)}
              aria-label={`Cost threshold: ${money(decision.th)}`}
            >
              <i style={{ width: `${thPercent}%`, background: 'var(--or)' }} />
            </div>
          </div>
        </div>

        <div className="hero-summary-pill">
          {dispute.merch ? (
            <span>Merchant error identified — fighting is prohibited.</span>
          ) : decision.out === 'ESCALATE' ? (
            <span>Automated decision halted by guardrails — human review required.</span>
          ) : isProfitable ? (
            <span>Expected recovery exceeds risk-adjusted cost by <strong>{money(decision.ev - decision.th)}</strong>.</span>
          ) : (
            <span>Expected recovery falls short of the fighting cost threshold. Conceding preserves capital.</span>
          )}
        </div>
      </div>

      {/* Decision Verdict Card */}
      <div className={`verdict ${decision.out}`} role="region" aria-label="Recommendation verdict">
        <div className="verdict-header">
          <span className="v">{capitalize(decision.out)}</span>
          <span className="verdict-badge">Agent Recommendation</span>
        </div>
        {decision.why.map((reason, idx) => (
          <p key={idx} className="verdict-reason">{reason}</p>
        ))}
      </div>

      {/* Escalation Brief (if flagged) */}
      {escalationBrief && <EscalationBrief brief={escalationBrief} />}

      {/* Step-by-step Audit & Decision Trace */}
      <DecisionTrace
        trace={decision.trace}
        policy={policy}
        flipHintText={flipHintText}
      />

      {/* Action Execution / Dry-Run Output */}
      <div className="action-area">
        {actioned ? (
          <div className="actioned-confirmation" role="status">
            <div className="actioned-header">
              <span className="actioned-badge">✓ Dispute {capitalize(actioned.act)}ed</span>
              <span className="mu">by {actioned.by} · {new Date(actioned.timestamp).toLocaleTimeString()}</span>
            </div>
            <pre className="mono dryrun-pre">
{`POST /api/v1/pa/payment_disputes/${dispute.id}/${actioned.act}
${actioned.act === 'challenge' ? `evidence_fields: [${decision.fields.join(', ')}]\n` : ''}// Dry-run simulator executed by ${actioned.by}.
// No live credentials transmitted. Nothing was sent to Airwallex.`}
            </pre>
          </div>
        ) : decision.out === 'ESCALATE' ? (
          <div className="acts">
            <button
              type="button"
              className="btn"
              onClick={() => onAction(dispute.id, 'challenge', 'human')}
            >
              Approve as Challenge (Human Override)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onAction(dispute.id, 'accept', 'human')}
            >
              Approve as Accept (Human Concede)
            </button>
          </div>
        ) : (
          <div className="acts">
            <button
              type="button"
              className="btn"
              onClick={() =>
                onAction(dispute.id, decision.out.toLowerCase(), 'agent')
              }
            >
              Execute {capitalize(decision.out)} (Dry Run)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
