import React, { useEffect } from 'react';

/**
 * Toast notification for user action confirmations.
 *
 * @param {{
 *   message: string,
 *   type?: 'success'|'error'|'info',
 *   onDismiss: () => void
 * }} props
 */
export default function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  };

  return (
    <div
      className={`toast toast-${type}`}
      role="status"
      aria-live="polite"
    >
      <span className="toast-icon" aria-hidden="true">{icons[type] || '•'}</span>
      <span className="toast-msg">{message}</span>
      <button
        type="button"
        className="toast-close"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}
