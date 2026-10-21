/**
 * DisputeIQ — Simulator Adapter
 *
 * Serves demo disputes from ../data.js through the same interface the
 * Airwallex adapter exposes, so the rest of the app never knows which
 * backend is running.
 *
 * All data is synthetic.  No real Airwallex calls are made.
 * The "Simulator" label must remain visible in the UI at all times.
 *
 * @module adapters/simulatorAdapter
 */

import { DISPUTES } from '../data.js';

// ─── Internal state ──────────────────────────────────────────────────────────

/** @type {Map<string, { action: 'accept'|'challenge', timestamp: string }>} */
const actionedDisputes = new Map();

/** Simulated network latency (ms). */
const LATENCY_MS = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Wrap a value in a Promise that resolves after LATENCY_MS.
 * @template T
 * @param {T} value
 * @returns {Promise<T>}
 */
function delayed(value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

/**
 * Map a flat demo dispute object into the Airwallex-like dispute shape.
 *
 * Demo fields → Airwallex shape:
 *   id → id
 *   t  → reason_code  (short description)
 *   a  → dispute_amount
 *   d  → respond_by   (computed from today + d days)
 *   n  → metadata.notes
 *   ev → evidence_files  (mapped to { name, strength, confidence, weight, field_id })
 *
 * @param {import('../data.js').Dispute} d  — flat demo dispute
 * @returns {AirwallexDisputeShape}
 */
function toAirwallexShape(d) {
  const now = new Date();
  const respondBy = new Date(now);
  respondBy.setDate(respondBy.getDate() + (d.d ?? 14));

  return {
    id: d.id,
    status: actionedDisputes.has(d.id)
      ? (actionedDisputes.get(d.id).action === 'accept' ? 'accepted' : 'challenged')
      : 'pending_response',
    dispute_amount: d.a,
    dispute_currency: 'USD',
    reason_code: d.t,
    created_at: now.toISOString(),
    respond_by: respondBy.toISOString(),
    payment_intent_id: `int_sim_${d.id}`,
    evidence_files: (d.ev || []).map((e) => ({
      name: e[0],
      strength: e[1],
      confidence: e[2],
      weight: e[3],
      field_id: e[4],
    })),
    // Preserve raw fields the decision engine needs
    _raw: { ...d },
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * List all demo disputes in Airwallex-like shape.
 * @returns {Promise<AirwallexDisputeShape[]>}
 */
export function listDisputes() {
  return delayed(DISPUTES.map(toAirwallexShape));
}

/**
 * Fetch a single demo dispute by ID.
 * @param {string} id
 * @returns {Promise<AirwallexDisputeShape|null>}
 */
export function getDispute(id) {
  const found = DISPUTES.find((d) => d.id === id);
  return delayed(found ? toAirwallexShape(found) : null);
}

/**
 * Accept a dispute (dry-run).
 *
 * If the dispute was already actioned, returns `{ alreadyActioned: true }`.
 *
 * @param {string} id
 * @returns {Promise<{ success: boolean, disputeId: string, action: 'accept', dryRun: true, timestamp: string } | { alreadyActioned: true }>}
 */
export function acceptDispute(id) {
  if (actionedDisputes.has(id)) {
    return delayed({ alreadyActioned: true });
  }

  const timestamp = new Date().toISOString();
  actionedDisputes.set(id, { action: 'accept', timestamp });

  return delayed({
    success: true,
    disputeId: id,
    action: 'accept',
    dryRun: true,
    timestamp,
  });
}

/**
 * Challenge a dispute with evidence (dry-run).
 *
 * If the dispute was already actioned, returns `{ alreadyActioned: true }`.
 *
 * @param {string} id
 * @param {string[]} evidence  — list of evidence field_ids to attach
 * @returns {Promise<{ success: boolean, disputeId: string, action: 'challenge', evidence: string[], dryRun: true, timestamp: string } | { alreadyActioned: true }>}
 */
export function challengeDispute(id, evidence = []) {
  if (actionedDisputes.has(id)) {
    return delayed({ alreadyActioned: true });
  }

  const timestamp = new Date().toISOString();
  actionedDisputes.set(id, { action: 'challenge', timestamp });

  return delayed({
    success: true,
    disputeId: id,
    action: 'challenge',
    evidence,
    dryRun: true,
    timestamp,
  });
}

// ─── Type definitions (JSDoc only) ──────────────────────────────────────────

/**
 * @typedef {Object} AirwallexDisputeShape
 * @property {string}  id
 * @property {string}  status               — 'pending_response' | 'accepted' | 'challenged'
 * @property {number}  dispute_amount
 * @property {string}  dispute_currency     — always 'USD' in simulator
 * @property {string}  reason_code
 * @property {string}  created_at           — ISO 8601
 * @property {string}  respond_by           — ISO 8601
 * @property {string}  payment_intent_id
 * @property {Array<{ name: string, strength: number, confidence: number, weight: number, field_id: string }>} evidence_files
 * @property {Object}  _raw                 — original flat demo object
 */
