import React from 'react';
import { money, decide, net } from '../logic.js';

/**
 * Backtest simulation comparing DisputeIQ's agentic policy against simple baseline strategies.
 *
 * Baseline strategies:
 * 1. "Always accept" (concede all disputes)
 * 2. "Always challenge" (fight every dispute regardless of probability or cost)
 * 3. "DisputeIQ" (intelligent risk-adjusted policy)
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
      name: 'DisputeIQ',
      value: sumNet((item) =>
        net(item.dispute, item.decision.out.toLowerCase(), policy)
      ),
      description: 'Expected-value thresholding with safety margin',
    },
  ];

  const maxVal = Math.max(...strategies.map((s) => Math.abs(s.value)), 1);
  const bestValue = Math.max(...strategies.map((s) => s.value));

  return (
    <section className="card bt" aria-labelledby="backtest-heading">
      <div className="section-header">
        <h2 id="backtest-heading">Backtest: Net Financial Outcome vs. Baselines</h2>
      </div>

      <div className="backtest-strategies">
        {strategies.map((strategy) => {
          const isBest = strategy.value === bestValue;
          const barWidthPercent = Math.min(
            100,
            Math.max(4, (Math.abs(strategy.value) / maxVal) * 100)
          );
          const barColor =
            strategy.name === 'DisputeIQ'
              ? 'var(--tl)'
              : strategy.value >= 0
              ? 'var(--gr)'
              : 'var(--mu)';

          return (
            <div className="backtest-row" key={strategy.name}>
              <div className="r">
                <span className="strategy-name">
                  <strong>{strategy.name}</strong>
                  {isBest && <span className="chip chip-best">Optimal</span>}
                </span>
                <span className="mono strategy-value">{money(strategy.value)}</span>
              </div>
              <div
                className="bar"
                role="progressbar"
                aria-valuenow={strategy.value}
                aria-label={`${strategy.name} net outcome: ${money(strategy.value)}`}
              >
                <i style={{ width: `${barWidthPercent}%`, background: barColor }} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="note">
        Evaluated across the <strong>{autoDecided.length}</strong> dispute{autoDecided.length === 1 ? '' : 's'} the agent decides automatically.{' '}
        {escalatedCount > 0 && (
          <span>({escalatedCount} escalated to a human are excluded from automated backtest.)</span>
        )}
      </p>
    </section>
  );
}
