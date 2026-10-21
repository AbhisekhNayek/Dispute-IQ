import React from 'react';
import { DEFAULT_POLICY, POLICY_FIELDS } from '../logic.js';

/**
 * Clean, compact Policy configuration panel.
 * Sliders update state instantly with clear formatting and no redundant clutter.
 *
 * @param {{
 *   policy: Object,
 *   onChange: (key: string, value: number) => void,
 *   onReset: () => void
 * }} props
 */
export default function PolicyPanel({ policy, onChange, onReset }) {
  const isDefault = Object.keys(DEFAULT_POLICY).every(
    (k) => policy[k] === DEFAULT_POLICY[k]
  );

  return (
    <section className="card policy-card" aria-labelledby="policy-heading">
      <div className="section-header">
        <div>
          <h2 id="policy-heading" className="card-title">Risk Policy</h2>
          <span className="mu card-subtitle">Finance guardrails</span>
        </div>
        <button
          type="button"
          className="btn-reset"
          onClick={onReset}
          disabled={isDefault}
          title="Restore standard default risk policy"
        >
          Reset to defaults
        </button>
      </div>

      <div className="policy-controls">
        {POLICY_FIELDS.map(([key, label, min, max, step, fmt]) => {
          const val = policy[key] ?? DEFAULT_POLICY[key];
          const formattedVal = fmt(val);

          return (
            <div className="policy-row" key={key}>
              <div className="policy-label-row">
                <label htmlFor={`policy-${key}`} className="policy-name">
                  {label}
                </label>
                <span className="mono policy-value">{formattedVal}</span>
              </div>
              <input
                id={`policy-${key}`}
                type="range"
                min={min}
                max={max}
                step={step}
                value={val}
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={val}
                aria-valuetext={formattedVal}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  if (!Number.isNaN(num)) {
                    onChange(key, num);
                  }
                }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
