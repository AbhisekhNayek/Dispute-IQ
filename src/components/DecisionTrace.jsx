import React, { useState } from 'react';
import { money } from '../logic.js';

/**
 * Step-by-step decision trace explaining how the deterministic policy engine
 * reached its conclusion. Includes exact policy values and a flip-hint.
 *
 * @param {{
 *   trace: Array<{ step: string, detail: string, result?: string|null }>,
 *   policy: Object,
 *   flipHintText: string|null
 * }} props
 */
export default function DecisionTrace({ trace = [], policy, flipHintText }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="trace-container" aria-label="Decision Trace">
      <div className="trace-header">
        <button
          type="button"
          className="trace-toggle-btn"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
        >
          <span className="trace-title">
            <span className="trace-icon" aria-hidden="true">{isOpen ? '▼' : '▶'}</span>
            <strong>Audit & Decision Trace</strong> ({trace.length} evaluation steps)
          </span>
          <span className="trace-policy-badge mono">
            Cost: {money(policy.cost)} · Margin: {policy.margin.toFixed(1)}× · Limit: {money(policy.limit)} · Conf: {policy.conf}%
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="trace-body">
          <ol className="trace-list">
            {trace.map((t, idx) => (
              <li key={`${idx}-${t.step}`} className="trace-step">
                <div className="trace-step-header">
                  <span className="trace-step-num">{idx + 1}.</span>
                  <strong className="trace-step-name">{t.step}</strong>
                  {t.result && (
                    <span className={`tag ${t.result} trace-step-tag`}>
                      {t.result}
                    </span>
                  )}
                </div>
                <div className="trace-step-detail mono">{t.detail}</div>
              </li>
            ))}
          </ol>

          {flipHintText && (
            <div className="flip-hint-box" role="note" aria-label="What would flip this decision">
              <div className="flip-hint-title">
                <span className="flip-icon" aria-hidden="true">💡</span>
                <strong>What would flip this decision?</strong>
              </div>
              <p className="flip-hint-text">{flipHintText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
