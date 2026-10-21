import React, { useState, useEffect, useCallback } from 'react';
import { DISPUTES } from './data.js';
import { DEFAULT_POLICY, clampPolicy, decide, flipHint } from './logic.js';
import { getAdapter, getModeName } from './adapters/index.js';

import DisputeQueue from './components/DisputeQueue.jsx';
import PolicyPanel from './components/PolicyPanel.jsx';
import DisputeDetail from './components/DisputeDetail.jsx';
import DecisionTrace from './components/DecisionTrace.jsx';
import BacktestPanel from './components/BacktestPanel.jsx';
import AuditLog from './components/AuditLog.jsx';
import Toast from './components/Toast.jsx';

const SESSION_LOG_KEY = 'disputeiq_audit_logs_v1';
const SESSION_ACTIONED_KEY = 'disputeiq_actioned_v1';

export default function App() {
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'trace' | 'backtest' | 'audit'

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
      // ignore
    }
  }, [auditLogs]);

  // Save actioned disputes to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_ACTIONED_KEY, JSON.stringify(actionedDisputes));
    } catch {
      // ignore
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
    addToast('Policy restored to defaults', 'info');
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
    addToast('Demo reset: all actions and logs cleared', 'info');
  }, [addToast]);

  const handleClearAuditLog = useCallback(() => {
    setAuditLogs([]);
    try {
      sessionStorage.removeItem(SESSION_LOG_KEY);
    } catch {
      // ignore
    }
    addToast('Audit log cleared', 'info');
  }, [addToast]);

  const handleExportAuditLog = useCallback(() => {
    if (!auditLogs.length) {
      addToast('No audit logs to export yet', 'info');
      return;
    }
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(
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
  const handleAction = useCallback(
    async (disputeId, action, actor) => {
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
          addToast(`Dispute ${disputeId} was already actioned`, 'error');
          return;
        }

        const timestamp = new Date().toISOString();

        setActionedDisputes((prev) => ({
          ...prev,
          [disputeId]: { act: action, by: actor, timestamp },
        }));

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
    },
    [actionedDisputes, policy, addToast]
  );

  const selectedDispute = DISPUTES[selectedIndex] || DISPUTES[0];
  const decision = decide(selectedDispute, policy);
  const flipHintText = flipHint(selectedDispute, policy);
  const modeName = getModeName();

  return (
    <div className="app-container">
      {/* Toast container */}
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

      {/* Sleek App Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">DisputeIQ</span>
          </div>
          <span className="brand-badge">Agentic Dispute Triage</span>
        </div>

        <div className="header-actions">
          <span
            className="chip-simulator"
            title="Local simulation mode. No live Airwallex API calls are made."
          >
            <span className="dot-indicator" aria-hidden="true" />
            {modeName === 'simulator' ? 'Simulator' : `Mode: ${modeName}`}
          </span>
          <button
            type="button"
            className="btn-icon"
            onClick={toggleTheme}
            aria-label="Toggle dark/light theme"
            title="Toggle theme"
          >
            ◑
          </button>
          <button
            type="button"
            className="btn-header"
            onClick={handleResetDemo}
            title="Reset demo data"
          >
            Reset demo
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="main-layout">
        {/* Left Column: Disputes & Policy */}
        <aside className="sidebar-col">
          <DisputeQueue
            disputes={DISPUTES}
            policy={policy}
            selectedIndex={selectedIndex}
            onSelect={(idx) => {
              setSelectedIndex(idx);
              // If in trace view, keep user on trace view for the newly selected dispute
            }}
            actionedDisputes={actionedDisputes}
          />

          <PolicyPanel
            policy={policy}
            onChange={handlePolicyChange}
            onReset={handleResetPolicy}
          />
        </aside>

        {/* Right Column: Tabbed Content Pane */}
        <section className="content-col">
          {/* Navigation Tabs */}
          <nav className="tab-nav" aria-label="Dispute views">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'trace' ? 'active' : ''}`}
              onClick={() => setActiveTab('trace')}
            >
              Decision Trace
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'backtest' ? 'active' : ''}`}
              onClick={() => setActiveTab('backtest')}
            >
              Portfolio Backtest
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              Audit Trail
              {auditLogs.length > 0 && (
                <span className="tab-counter">{auditLogs.length}</span>
              )}
            </button>
          </nav>

          {/* Active Tab View */}
          <div className="tab-content">
            {activeTab === 'overview' && (
              <DisputeDetail
                dispute={selectedDispute}
                policy={policy}
                actioned={actionedDisputes[selectedDispute?.id]}
                onAction={handleAction}
                onViewTrace={() => setActiveTab('trace')}
              />
            )}

            {activeTab === 'trace' && (
              <DecisionTrace
                dispute={selectedDispute}
                trace={decision.trace}
                policy={policy}
                flipHintText={flipHintText}
              />
            )}

            {activeTab === 'backtest' && (
              <BacktestPanel
                disputes={DISPUTES}
                policy={policy}
              />
            )}

            {activeTab === 'audit' && (
              <AuditLog
                logs={auditLogs}
                onExport={handleExportAuditLog}
                onClear={handleClearAuditLog}
              />
            )}
          </div>
        </section>
      </main>

      {/* Clean, unobtrusive footer */}
      <footer className="app-footer">
        <span className="mu text-xs">
          DisputeIQ Simulator · Demo data is illustrative, not real win rates. No real cardholder funds or credentials used.
        </span>
      </footer>
    </div>
  );
}
