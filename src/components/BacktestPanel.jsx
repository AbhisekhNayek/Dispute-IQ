import React from 'react';
import { money, decide, net } from '../logic.js';

/**
 * Clean, modern Backtest simulation panel.
 * Compares DisputeIQ's agentic policy against baseline strategies.
 *
 * @param {{ disputes: Array, policy: Object }} props
 */
export default function BacktestPanel({ disputes = [], policy }) {
  const evaluations = disputes.map((d) => ({
    dispute: d,
    decision: decide(d, policy),
  }));

  const autoDecided = evaluations.filter((e) => e.decision.out !== 'ESCALATE');
  const escalatedCount = disputes.length - autoDecided.length;

  const sumNet = (calculator) =>
    autoDecided.reduce((acc, item) => acc + calculator(item), 0);

  const strategies = [
    {
      name: 'Always accept',
      value: sumNet((item) => net(item.dispute, 'accept', policy)),
      description: 'Concede all disputes immediately',
    },
    {
      name: 'Always challenge',
      value: sumNet((item) => net(item.dispute, 'challenge', policy)),
      description: 'Fight every dispute blindly',
    },
    {
      name: 'DisputeIQ (Agentic)',
      value: sumNet((item) =>
        net(item.dispute, item.decision.out.toLowerCase(), policy)
      ),
      description: 'Dynamic expected-value thresholding',
    },
  ];

  const maxVal = Math.max(...strategies.map((s) => Math.abs(s.value)), 1);
  const bestValue = Math.max(...strategies.map((s) => s.value));

  return (
    <div className="backtest-view">
      <section className="card">
        <div className="section-header">
          <div>
            <h2 className="card-title">Portfolio Backtest Comparison</h2>
            <span className="mu card-subtitle">
              Net financial return across {autoDecided.length} automated disputes
              {escalatedCount > 0 && ` (${escalatedCount} escalated excluded)`}
            </span>
          </div>
        </div>

        <div className="backtest-cards-grid">
          {strategies.map((strat) => {
            const isBest = strat.value === bestValue;
            const barWidth = Math.min(
              100,
              Math.max(5, (Math.abs(strat.value) / maxVal) * 100)
            );
            const isDisputeIQ = strat.name.includes('DisputeIQ');

            return (
              <div
                className={`backtest-card ${isBest ? 'is-best' : ''}`}
                key={strat.name}
              >
                <div className="backtest-card-top">
                  <div className="strategy-info">
                    <span className="strategy-title">{strat.name}</span>
                    <span className="mu strategy-desc">{strat.description}</span>
                  </div>
                  {isBest && <span className="best-tag">Optimal</span>}
                </div>

                <div className="backtest-card-middle">
                  <span
                    className={`mono strategy-return ${
                      strat.value >= 0 ? 'return-positive' : 'return-negative'
                    }`}
                  >
                    {money(strat.value)}
                  </span>
                </div>

                <div className="progress-track" role="progressbar" aria-valuenow={strat.value}>
                  <div
                    className={`progress-fill ${
                      isDisputeIQ ? 'fill-teal' : strat.value >= 0 ? 'fill-green' : 'fill-muted'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="backtest-footer-note mu">
          Calculations evaluate financial recovery vs. cost to fight ($ {policy.cost}) based on current policy inputs.
        </div>
      </section>
    </div>
  );
}
