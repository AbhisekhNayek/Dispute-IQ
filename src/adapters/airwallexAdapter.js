/**
 * DisputeIQ — Airwallex Adapter (proxy-based)
 *
 * Calls a local Express proxy that handles Airwallex authentication.
 * The proxy is expected at /api/proxy/... and forwards to the real
 * Airwallex API.
 *
 * Verified Airwallex endpoints (Kit 4 docs):
 *   POST /api/v1/authentication/login
 *   GET  /api/v1/pa/payment_disputes
 *   GET  /api/v1/pa/payment_disputes/{id}
 *   POST /api/v1/pa/payment_disputes/{id}/accept
 *   POST /api/v1/pa/payment_disputes/{id}/challenge
 *
 * No API keys or secrets are stored in this file.
 * The proxy server (.env) holds all credentials.
 *
 * @module adapters/airwallexAdapter
 */

// ─── Proxy base URL ─────────────────────────────────────────────────────────

const PROXY_BASE = '/api/proxy';

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * Send a request to the local proxy and parse the JSON response.
 *
 * @param {string} path   — path relative to PROXY_BASE (e.g. '/disputes')
 * @param {RequestInit} [opts]  — fetch options
 * @returns {Promise<any>}
 * @throws {Error} on non-2xx response
 */
async function proxyFetch(path, opts = {}) {
  const url = `${PROXY_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Airwallex proxy error ${res.status}: ${body}`);
  }

  return res.json();
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * List all payment disputes.
 *
 * Proxy route:  GET /api/proxy/disputes
 * Airwallex:    GET /api/v1/pa/payment_disputes
 *
 * @returns {Promise<AirwallexDispute[]>}  Array of dispute objects
 */
export async function listDisputes() {
  const data = await proxyFetch('/disputes');
  // TODO: verify response shape — expecting { items: [...] } or top-level array
  return data.items ?? data;
}

/**
 * Get a single dispute by ID.
 *
 * Proxy route:  GET /api/proxy/disputes/:id
 * Airwallex:    GET /api/v1/pa/payment_disputes/{id}
 *
 * @param {string} id  — dispute ID
 * @returns {Promise<AirwallexDispute>}
 */
export async function getDispute(id) {
  return proxyFetch(`/disputes/${encodeURIComponent(id)}`);
}

/**
 * Accept (concede) a dispute.
 *
 * Proxy route:  POST /api/proxy/disputes/:id/accept
 * Airwallex:    POST /api/v1/pa/payment_disputes/{id}/accept
 *
 * @param {string} id  — dispute ID
 * @returns {Promise<{ success: boolean, disputeId: string, action: 'accept', timestamp: string }>}
 */
export async function acceptDispute(id) {
  const result = await proxyFetch(`/disputes/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
    body: JSON.stringify({
      // TODO: verify if a body is required for the accept endpoint
    }),
  });

  return {
    success: true,
    disputeId: id,
    action: 'accept',
    timestamp: new Date().toISOString(),
    ...result,
  };
}

/**
 * Challenge a dispute with supporting evidence.
 *
 * Proxy route:  POST /api/proxy/disputes/:id/challenge
 * Airwallex:    POST /api/v1/pa/payment_disputes/{id}/challenge
 *
 * @param {string} id        — dispute ID
 * @param {string[]} evidence — list of evidence field IDs to attach
 * @returns {Promise<{ success: boolean, disputeId: string, action: 'challenge', evidence: string[], timestamp: string }>}
 */
export async function challengeDispute(id, evidence = []) {
  // Build the evidence payload.
  // The Airwallex challenge endpoint expects evidence grouped by field.
  // TODO: verify exact payload structure — this is our best guess from docs
  const evidencePayload = {};
  for (const fieldId of evidence) {
    evidencePayload[fieldId] = evidencePayload[fieldId] || [];
    // TODO: verify whether file_ids or inline content is expected
    evidencePayload[fieldId].push(fieldId);
  }

  const result = await proxyFetch(`/disputes/${encodeURIComponent(id)}/challenge`, {
    method: 'POST',
    body: JSON.stringify({
      evidence: evidencePayload, // TODO: verify field name ('evidence' vs 'evidence_files')
    }),
  });

  return {
    success: true,
    disputeId: id,
    action: 'challenge',
    evidence,
    timestamp: new Date().toISOString(),
    ...result,
  };
}

// ─── Type definitions (JSDoc only) ──────────────────────────────────────────

/**
 * @typedef {Object} AirwallexDispute
 * @property {string}  id
 * @property {string}  status                — e.g. 'pending_response', 'accepted', 'challenged'
 * @property {number}  dispute_amount        — TODO: verify field name
 * @property {string}  dispute_currency
 * @property {string}  reason_code           — TODO: verify field name
 * @property {string}  created_at            — ISO 8601
 * @property {string}  respond_by            — TODO: verify field name (could be 'due_date')
 * @property {string}  payment_intent_id     — TODO: verify field name
 * @property {Array}   evidence_files        — TODO: verify structure
 */
