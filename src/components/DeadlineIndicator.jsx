import React from 'react';

/**
 * Visual and accessible indicator of time remaining to respond to a dispute.
 * Applies urgency styling when 3 days or fewer remain.
 *
 * @param {{ days: number, showIcon?: boolean }} props
 */
export default function DeadlineIndicator({ days, showIcon = true }) {
  let urgency = 'normal';
  let badgeLabel = `${days}d left`;
  let ariaLabel = `${days} days left to respond`;

  if (days <= 0) {
    urgency = 'critical';
    badgeLabel = 'Due today';
    ariaLabel = 'Due today! Immediate action required';
  } else if (days <= 3) {
    urgency = 'critical';
    badgeLabel = `${days}d left (urgent)`;
    ariaLabel = `Urgent: only ${days} days left to respond`;
  } else if (days <= 7) {
    urgency = 'warning';
    badgeLabel = `${days}d left`;
    ariaLabel = `${days} days left to respond`;
  }

  return (
    <span
      className={`deadline-indicator deadline-${urgency}`}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {showIcon && urgency === 'critical' && (
        <span className="deadline-icon" aria-hidden="true">⚠️</span>
      )}
      <span className="deadline-text">{badgeLabel}</span>
    </span>
  );
}
