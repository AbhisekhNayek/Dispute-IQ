import React from 'react';
import { money } from '../logic.js';

/**
 * Step-by-step decision trace explaining how the deterministic policy engine
 * reached its conclusion. Includes exact policy values and a flip-hint.
 *
 * @param {{
 *   dispute?: Object,
 *   trace: Array<{ step: string, detail: string, result?: string|null }>,
 *   policy: Object,
 *   flipHintText: string|null
 * }} props
 */
export default function DecisionTrace({
  dispute,
  trace = [],
  policy,
  flipHintText,
}) {
  return (
    <div className="trace-view">
      <section className="card">
        <div className="section-header">
          <div>
            <h2 className="card-title">Deterministic Decision Trace</h2>
            <span className="mu card-subtitle">
              Auditable execution log for {dispute ? dispute.id : 'current dispute'}
            </span>
          </div>
          <div className="policy-chips-row mono">
            <span className="chip chip-static">Cost: {money(policy.cost)}</span>
            <span className="chip chip-static">Margin: {policy.margin.toFixed(1)}×</span>
            <span className="chip chip-static">Limit: {money(policy.limit)}</span>
            <span className="chip chip-static">Min Conf: {policy.conf}%</span>
          </div>
        </div>

        {flipHintText && (
          <div className="flip-callout" role="note" aria-label="What would flip this decision">
            <div className="flip-callout-icon" aria-hidden="true">💡</div>
            <div className="flip-callout-content">
              <strong>What would flip this decision?</strong>
              <p>{flipHintText}</p>
            </div>
          </div>
        )}

        <div className="trace-timeline">
          {trace.map((step, idx) => (
            <div key={`${idx}-${step.step}`} className="trace-timeline-item">
              <div className="trace-step-marker mono">{idx + 1}</div>
              <div className="trace-step-content">
                <div className="trace-step-top">
                  <span className="trace-step-name">{step.step}</span>
                  {step.result && (
                    <span className={`tag ${step.result} trace-tag`}>
                      {step.result}
                    </span>
                  )}
                </div>
                <div className="trace-step-math mono">{step.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
