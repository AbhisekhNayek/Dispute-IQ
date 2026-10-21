/**
 * grader.js — LLM-powered evidence grader for dispute responses.
 *
 * Uses Claude (Anthropic API) to score evidence texts for strength and
 * confidence. All PII is redacted before sending to the LLM.
 *
 * Gated behind ENABLE_LLM_GRADER=true and a valid ANTHROPIC_API_KEY.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// ─── PII Redaction ──────────────────────────────────────────────────────────

/**
 * Regex patterns for PII we want to strip before sending to the LLM.
 *  - Card numbers: 13-19 digit sequences (with optional dashes/spaces)
 *  - Emails: standard addr-spec
 *  - Names: sequences of Title Case words (≥2 consecutive) at word boundaries
 */
const CARD_RE = /\b\d[\d\s-]{11,17}\d\b/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const NAME_RE = /\b(?:[A-Z][a-z]+(?:\s+|$)){2,}/g;

/**
 * Redact PII from a text string.
 *
 * @param {string} text — Raw evidence text
 * @returns {string} Redacted text with placeholders
 */
export function redact(text) {
  return text
    .replace(CARD_RE, '[CARD_REDACTED]')
    .replace(EMAIL_RE, '[EMAIL_REDACTED]')
    .replace(NAME_RE, '[NAME_REDACTED] ');
}

// ─── Schema Validation ──────────────────────────────────────────────────────

/**
 * Validate that the parsed LLM response matches our expected schema:
 * Array of { evidenceId, strength: 0-1, confidence: 0-1, rationale }
 *
 * @param {unknown} data — Parsed JSON from the LLM
 * @returns {{ valid: boolean; error?: string }}
 */
function validateGrades(data) {
  if (!Array.isArray(data)) {
    return { valid: false, error: 'Response is not an array' };
  }

  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    if (typeof item !== 'object' || item === null) {
      return { valid: false, error: `Item ${i} is not an object` };
    }

    if (typeof item.evidenceId === 'undefined') {
      return { valid: false, error: `Item ${i} missing evidenceId` };
    }

    if (typeof item.strength !== 'number' || item.strength < 0 || item.strength > 1) {
      return {
        valid: false,
        error: `Item ${i} strength must be a number in [0, 1]`,
      };
    }

    if (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1) {
      return {
        valid: false,
        error: `Item ${i} confidence must be a number in [0, 1]`,
      };
    }

    if (typeof item.rationale !== 'string' || item.rationale.length === 0) {
      return { valid: false, error: `Item ${i} missing or empty rationale` };
    }
  }

  return { valid: true };
}

// ─── System Prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert dispute-response analyst for payment disputes.

You will receive an array of evidence texts (already redacted for PII).
For each piece of evidence, return a JSON array with one object per evidence item.

Each object MUST have exactly these fields:
- "evidenceId": integer index (0-based) matching the input array position
- "strength": number 0-1 — how strongly this evidence supports a successful challenge
- "confidence": number 0-1 — your confidence in the strength assessment
- "rationale": string — brief explanation (1-2 sentences)

Respond with ONLY the JSON array. No markdown fences, no extra text.`;

// ─── Grading ────────────────────────────────────────────────────────────────

/**
 * Grade an array of evidence texts using Claude.
 *
 * @param {string[]} evidenceTexts — Array of raw evidence text strings
 * @returns {Promise<{ fallback: boolean; grades: Array|null; error?: string }>}
 */
export async function gradeEvidence(evidenceTexts) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

    if (!apiKey) {
      return { fallback: true, grades: null, error: 'ANTHROPIC_API_KEY not set' };
    }

    // Redact all evidence before sending to LLM
    const redacted = evidenceTexts.map((t) => redact(t));

    const userMessage = JSON.stringify(
      redacted.map((text, i) => ({ index: i, text })),
      null,
      2
    );

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        fallback: true,
        grades: null,
        error: `Anthropic API error (${res.status}): ${errText}`,
      };
    }

    const data = await res.json();

    // Extract text from the first content block
    const content = data?.content?.[0]?.text;
    if (!content) {
      return {
        fallback: true,
        grades: null,
        error: 'No text content in Anthropic response',
      };
    }

    // Parse the JSON response
    let grades;
    try {
      grades = JSON.parse(content);
    } catch {
      return {
        fallback: true,
        grades: null,
        error: `Failed to parse LLM response as JSON: ${content.slice(0, 200)}`,
      };
    }

    // Validate schema
    const validation = validateGrades(grades);
    if (!validation.valid) {
      return {
        fallback: true,
        grades: null,
        error: `Schema validation failed: ${validation.error}`,
      };
    }

    return { fallback: false, grades, error: undefined };
  } catch (/** @type {any} */ err) {
    return {
      fallback: true,
      grades: null,
      error: `Grader exception: ${err.message}`,
    };
  }
}

// ─── Feature Flag ───────────────────────────────────────────────────────────

/**
 * Check whether the LLM grader is enabled and configured.
 *
 * @returns {boolean}
 */
export function isEnabled() {
  return (
    process.env.ENABLE_LLM_GRADER === 'true' &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}
