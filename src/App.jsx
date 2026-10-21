import React, { useState, useEffect, useCallback } from 'react';
import { DISPUTES } from './data.js';
import { DEFAULT_POLICY, clampPolicy } from './logic.js';
import { getAdapter, getModeName } from './adapters/index.js';

import DisputeQueue from './components/DisputeQueue.jsx';
import PolicyPanel from './components/PolicyPanel.jsx';
import DisputeDetail from './components/DisputeDetail.jsx';
import AuditLog from './components/AuditLog.jsx';
import BacktestPanel from './components/BacktestPanel.jsx';
import Toast from './components/Toast.jsx';

const SESSION_LOG_KEY = 'disputeiq_audit_logs_v1';
const SESSION_ACTIONED_KEY = 'disputeiq_actioned_v1';

export default function App() {
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Restore audit log from sessionStorage
  const [auditLogs, setAuditLogs] = useState(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_LOG_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Restore actioned status from sessionStorage
  const [actionedDisputes, setActionedDisputes] = useState(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_ACTIONED_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [toasts, setToasts] = useState([]);

  // Save audit logs to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_LOG_KEY, JSON.stringify(auditLogs));
    } catch {
      // sessionStorage quota or disabled
    }
  }, [auditLogs]);

  // Save actioned disputes to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_ACTIONED_KEY, JSON.stringify(actionedDisputes));
    } catch {
      // sessionStorage quota or disabled
    }
  }, [actionedDisputes]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handlePolicyChange = useCallback((key, value) => {
    setPolicy((prev) => clampPolicy({ ...prev, [key]: value }));
  }, []);

  const handleResetPolicy = useCallback(() => {
    setPolicy(DEFAULT_POLICY);
    addToast('Policy restored to default risk limits', 'info');
  }, [addToast]);

  const handleResetDemo = useCallback(() => {
    setActionedDisputes({});
    setAuditLogs([]);
    setPolicy(DEFAULT_POLICY);
    setSelectedIndex(0);
    try {
      sessionStorage.removeItem(SESSION_LOG_KEY);
      sessionStorage.removeItem(SESSION_ACTIONED_KEY);
    } catch {
      // ignore
    }
    addToast('Demo reset: all actions and audit history cleared', 'info');
  }, [addToast]);

  const handleClearAuditLog = useCallback(() => {
    setAuditLogs([]);
    try {
      sessionStorage.removeItem(SESSION_LOG_KEY);
    } catch {
      // ignore
    }
    addToast('Audit log cleared for this session', 'info');
  }, [addToast]);

  const handleExportAuditLog = useCallback(() => {
    if (!auditLogs.length) {
      addToast('No audit logs to export yet', 'info');
      return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(
      JSON.stringify(
        {
          application: 'DisputeIQ',
          mode: getModeName(),
          exportedAt: new Date().toISOString(),
          activePolicy: policy,
          logs: auditLogs,
        },
        null,
        2
      )
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `disputeiq-audit-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addToast('Audit log exported as JSON', 'success');
  }, [auditLogs, policy, addToast]);

  const toggleTheme = useCallback(() => {
    const root = document.documentElement;
    const isDark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = isDark ? 'light' : 'dark';
  }, []);

  // Execute an action on a dispute via the active adapter
  const handleAction = useCallback(async (disputeId, action, actor) => {
    // Check local idempotency
    if (actionedDisputes[disputeId]) {
      addToast(`Dispute ${disputeId} has already been actioned`, 'error');
      return;
    }

    const adapter = getAdapter();
    const dispute = DISPUTES.find((d) => d.id === disputeId);
    const evidenceFields = dispute ? [...new Set(dispute.ev.map((e) => e[4]))] : [];

    try {
      let result;
      if (action === 'challenge') {
        result = await adapter.challengeDispute(disputeId, evidenceFields);
      } else {
        result = await adapter.acceptDispute(disputeId);
      }

      if (result.alreadyActioned) {
        addToast(`Dispute ${disputeId} was already actioned on server`, 'error');
        return;
      }

      const timestamp = new Date().toISOString();

      // Record actioned state
      setActionedDisputes((prev) => ({
        ...prev,
        [disputeId]: { act: action, by: actor, timestamp },
      }));

      // Record in audit log with policy snapshot
      const newLogEntry = {
        timestamp,
        disputeId,
        action,
        actor,
        policySnapshot: { ...policy },
        simulated: result.dryRun ?? true,
      };

      setAuditLogs((prev) => [newLogEntry, ...prev]);

      addToast(
        `Dispute ${disputeId} ${action}ed by ${actor} (${result.dryRun ? 'dry run' : 'live'})`,
        'success'
      );
    } catch (err) {
      addToast(`Action failed: ${err.message}`, 'error');
    }
  }, [actionedDisputes, policy, addToast]);

  const selectedDispute = DISPUTES[selectedIndex] || DISPUTES[0];
  const modeName = getModeName();

  return (
    <div className="wrap">
      {/* Toast notifications container */}
      <div className="toast-container" aria-live="assertive">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            onDismiss={() => dismissToast(t.id)}
          />
        ))}
      </div>

      {/* Header */}
      <header>
        <div className="logo" aria-label="DisputeIQ brand">
          <span className="logo-accent">⚡</span> DisputeIQ
        </div>
        <div className="tools">
          <span
            className="chip s"
            title="All operations run in local simulation mode. No live Airwallex API calls are made."
          >
            {modeName === 'simulator'
              ? 'Simulator: nothing is sent to Airwallex'
              : `Mode: ${modeName} (Dry-Run)`}
          </span>
          <button
            type="button"
            className="chip"
            onClick={toggleTheme}
            aria-label="Toggle dark/light theme"
          >
            Switch theme
          </button>
          <button
            type="button"
            className="chip chip-warn"
            onClick={handleResetDemo}
            aria-label="Reset demo and clear session actions"
          >
            Reset demo
          </button>
        </div>
      </header>

      {/* Product Lead */}
      <p className="lead">
        Fighting a chargeback is a calculated bet. DisputeIQ couples transparent economic policy
        with evidence analysis so your finance team stays in full control of capital recovery.
      </p>

      {/* Main Grid: Queue & Policy on Left | Detail, Audit, Backtest on Right */}
      <main className="grid">
        <div className="col left-col">
          <DisputeQueue
            disputes={DISPUTES}
            policy={policy}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            actionedDisputes={actionedDisputes}
          />

          <PolicyPanel
            policy={policy}
            onChange={handlePolicyChange}
            onReset={handleResetPolicy}
          />
        </div>

        <div className="col right-col">
          <DisputeDetail
            dispute={selectedDispute}
            policy={policy}
            actioned={actionedDisputes[selectedDispute?.id]}
            onAction={handleAction}
          />

          <AuditLog
            logs={auditLogs}
            onExport={handleExportAuditLog}
            onClear={handleClearAuditLog}
          />

          <BacktestPanel
            disputes={DISPUTES}
            policy={policy}
          />
        </div>
      </main>

      {/* Mandatory Disclaimer Footer */}
      <footer>
        <p className="note">
          DisputeIQ Simulator · Demo data is hand-labelled and illustrative, not real win rates.
          No live Airwallex credentials or funds are used.
        </p>
      </footer>
    </div>
  );
}
