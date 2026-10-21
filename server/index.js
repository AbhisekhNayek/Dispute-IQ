/**
 * index.js — DisputeIQ Express proxy server.
 *
 * Proxies verified Airwallex dispute endpoints and exposes an optional
 * LLM grading endpoint. Write actions (accept/challenge) are dry-run
 * by default for safety.
 *
 * Verified Airwallex endpoints:
 *   POST /api/v1/authentication/login
 *   GET  /api/v1/pa/payment_disputes
 *   GET  /api/v1/pa/payment_disputes/:id
 *   POST /api/v1/pa/payment_disputes/:id/accept
 *   POST /api/v1/pa/payment_disputes/:id/challenge
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authenticatedFetch } from './airwallex.js';
import { gradeEvidence, isEnabled as graderIsEnabled } from './grader.js';

const app = express();
const PORT = process.env.PORT || 3001;
const DRY_RUN = process.env.DRY_RUN !== 'false'; // default: true

app.use(cors());
app.use(express.json());

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    dryRun: DRY_RUN,
    graderEnabled: graderIsEnabled(),
  });
});

// ─── Dispute Proxy Routes ───────────────────────────────────────────────────

/**
 * GET /api/proxy/disputes
 * Proxies → GET /api/v1/pa/payment_disputes
 */
app.get('/api/proxy/disputes', async (_req, res) => {
  try {
    const awxRes = await authenticatedFetch('/api/v1/pa/payment_disputes');
    const data = await awxRes.json();
    res.status(awxRes.status).json(data);
  } catch (/** @type {any} */ err) {
    console.error('[proxy] GET disputes error:', err.message);
    res.status(502).json({ error: 'Failed to fetch disputes', detail: err.message });
  }
});

/**
 * GET /api/proxy/disputes/:id
 * Proxies → GET /api/v1/pa/payment_disputes/:id
 */
app.get('/api/proxy/disputes/:id', async (req, res) => {
  try {
    const awxRes = await authenticatedFetch(
      `/api/v1/pa/payment_disputes/${req.params.id}`
    );
    const data = await awxRes.json();
    res.status(awxRes.status).json(data);
  } catch (/** @type {any} */ err) {
    console.error('[proxy] GET dispute detail error:', err.message);
    res.status(502).json({ error: 'Failed to fetch dispute', detail: err.message });
  }
});

/**
 * POST /api/proxy/disputes/:id/accept
 * Proxies → POST /api/v1/pa/payment_disputes/:id/accept
 *
 * Guarded by DRY_RUN — returns simulated success unless DRY_RUN=false.
 */
app.post('/api/proxy/disputes/:id/accept', async (req, res) => {
  const { id } = req.params;

  if (DRY_RUN) {
    console.log(`[dry-run] Would accept dispute ${id}`);
    return res.json({
      simulated: true,
      action: 'accept',
      disputeId: id,
      message: 'DRY_RUN enabled — no request sent to Airwallex.',
    });
  }

  try {
    const awxRes = await authenticatedFetch(
      `/api/v1/pa/payment_disputes/${id}/accept`,
      { method: 'POST', body: JSON.stringify(req.body) }
    );
    const data = await awxRes.json();
    res.status(awxRes.status).json(data);
  } catch (/** @type {any} */ err) {
    console.error('[proxy] POST accept error:', err.message);
    res.status(502).json({ error: 'Failed to accept dispute', detail: err.message });
  }
});

/**
 * POST /api/proxy/disputes/:id/challenge
 * Proxies → POST /api/v1/pa/payment_disputes/:id/challenge
 *
 * Guarded by DRY_RUN — returns simulated success unless DRY_RUN=false.
 */
app.post('/api/proxy/disputes/:id/challenge', async (req, res) => {
  const { id } = req.params;

  if (DRY_RUN) {
    console.log(`[dry-run] Would challenge dispute ${id}`);
    return res.json({
      simulated: true,
      action: 'challenge',
      disputeId: id,
      message: 'DRY_RUN enabled — no request sent to Airwallex.',
    });
  }

  try {
    const awxRes = await authenticatedFetch(
      `/api/v1/pa/payment_disputes/${id}/challenge`,
      { method: 'POST', body: JSON.stringify(req.body) }
    );
    const data = await awxRes.json();
    res.status(awxRes.status).json(data);
  } catch (/** @type {any} */ err) {
    console.error('[proxy] POST challenge error:', err.message);
    res.status(502).json({ error: 'Failed to challenge dispute', detail: err.message });
  }
});

// ─── LLM Grader Endpoint ───────────────────────────────────────────────────

/**
 * POST /api/grader/grade
 * Body: { evidenceTexts: string[] }
 * Returns graded evidence or fallback response.
 *
 * Only active when ENABLE_LLM_GRADER=true and ANTHROPIC_API_KEY is set.
 */
app.post('/api/grader/grade', async (req, res) => {
  if (!graderIsEnabled()) {
    return res.status(403).json({
      error: 'LLM grader is not enabled',
      hint: 'Set ENABLE_LLM_GRADER=true and ANTHROPIC_API_KEY in .env',
    });
  }

  const { evidenceTexts } = req.body;

  if (!Array.isArray(evidenceTexts) || evidenceTexts.length === 0) {
    return res.status(400).json({
      error: 'Request body must include a non-empty "evidenceTexts" array',
    });
  }

  try {
    const result = await gradeEvidence(evidenceTexts);
    res.json(result);
  } catch (/** @type {any} */ err) {
    console.error('[grader] Unexpected error:', err.message);
    res.status(500).json({
      fallback: true,
      grades: null,
      error: `Server error: ${err.message}`,
    });
  }
});

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`DisputeIQ server listening on http://localhost:${PORT}`);
  console.log(`  DRY_RUN     : ${DRY_RUN}`);
  console.log(`  LLM Grader  : ${graderIsEnabled() ? 'enabled' : 'disabled'}`);
});
