/**
 * DisputeIQ — Decision logic (pure, framework-free)
 *
 * This module is the single source of truth for dispute-resolution decisions.
 * It can be used in the browser, Node, or any JS runtime.
 *
 * Design principle: the LLM reads and explains evidence; deterministic code
 * scores and enforces policy.  The model never has the final say on money.
 */

// ─── Default policy ──────────────────────────────────────────────────────────

/** @type {Policy} */
export const DEFAULT_POLICY = {
  cost: 25,     // $ per dispute to fight
  margin: 1.2,  // safety multiplier on cost
  limit: 2000,  // auto-approval ceiling ($)
  conf: 60,     // minimum confidence (%)
};

// ─── Policy field descriptors (for UI sliders) ──────────────────────────────

/**
 * Each entry: [key, label, min, max, step, formatter]
 * @type {Array<[string, string, number, number, number, (v: number) => string]>}
 */
export const POLICY_FIELDS = [
  ['cost',   'Cost to fight one dispute',  5,   100,   5,   (v) => money(v)],
  ['margin', 'Safety margin',              1,   3,     0.1, (v) => (+v).toFixed(1) + '×'],
  ['limit',  'Auto-approval limit',        500, 10000, 250, (v) => money(v)],
  ['conf',   'Minimum confidence',         30,  90,    5,   (v) => v + '%'],
];

// ─── Formatters ──────────────────────────────────────────────────────────────

/** Format a number as dollars: $1,234 or −$500 */
export function money(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  return (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
}

/** Format a 0-1 number as a percentage: 85% */
export function pct(x) {
  if (typeof x !== 'number' || Number.isNaN(x)) return '0%';
  return Math.round(x * 100) + '%';
}

// ─── Policy validation ──────────────────────────────────────────────────────

/**
 * Clamp a policy value to its valid range.  Rejects NaN → falls back to default.
 * @param {Policy} raw
 * @returns {Policy}
 */
export function clampPolicy(raw) {
  const out = {};
  for (const [key, , min, max] of POLICY_FIELDS) {
    let v = raw?.[key];
    if (typeof v !== 'number' || Number.isNaN(v)) v = DEFAULT_POLICY[key];
    out[key] = Math.min(max, Math.max(min, v));
  }
  return out;
}

/**
 * Validate policy inputs. Returns an array of error messages (empty = valid).
 * @param {Policy} p
 * @returns {string[]}
 */
export function validatePolicy(p) {
  const errors = [];
  for (const [key, label, min, max] of POLICY_FIELDS) {
    const v = p?.[key];
    if (typeof v !== 'number' || Number.isNaN(v)) {
      errors.push(`${label} must be a number.`);
    } else if (v < min || v > max) {
      errors.push(`${label} must be between ${min} and ${max}.`);
    }
  }
  return errors;
}

// ─── Core decision engine ───────────────────────────────────────────────────

/**
 * Decide whether to ACCEPT, CHALLENGE, or ESCALATE a dispute.
 *
 * Decision rule:
 *   challenge when  (win_probability × amount) > (cost × margin)
 *   escalate  when  amount > limit  OR  confidence < minimum  OR  evidence conflicts
 *   accept    when  genuine merchant error  OR  expected recovery too low
 *
 * @param {{ a: number, ev: Array, merch?: number, conflict?: number, d?: number }} dispute
 * @param {Policy} policy
 * @returns {DecisionResult}
 */
export function decide(dispute, policy) {
  const P = clampPolicy(policy);
  const ev = dispute.ev || [];

  // Weighted scores
  const totalWeight = ev.reduce((a, e) => a + e[3], 0) || 1;
  const winProb = ev.reduce((a, e) => a + e[1] * e[3], 0) / totalWeight;
  let confidence = ev.reduce((a, e) => a + e[2] * e[3], 0) / totalWeight;
  if (dispute.conflict) confidence *= 0.6;

  const expectedValue = winProb * dispute.a;
  const threshold = P.cost * P.margin;
  const fields = [...new Set(ev.map((e) => e[4]))];

  // Trace: step-by-step reasoning
  const trace = [];
  let out, why = [];

  // ── Merchant error override ──
  if (dispute.merch) {
    out = 'ACCEPT';
    why = [
      'This is a genuine merchant error (e.g. duplicate charge). ' +
      'Fighting it would fail and add cost, so the agent accepts immediately.',
    ];
    trace.push(
      { step: 'Merchant error flag', detail: 'merch = true → auto-accept', result: 'ACCEPT' },
    );
    return { p: winProb, c: confidence, ev: expectedValue, th: threshold, out, why, fields, trace, policy: { ...P } };
  }

  // ── Evidence scoring ──
  trace.push({
    step: 'Evidence scoring',
    detail: `${ev.length} pieces of evidence. ` +
      `Weighted win probability = ${pct(winProb)}, confidence = ${pct(confidence)}` +
      (dispute.conflict ? ' (reduced 40% for conflicting evidence)' : ''),
    result: null,
  });

  // ── Expected value calculation ──
  trace.push({
    step: 'Expected value',
    detail: `${pct(winProb)} × ${money(dispute.a)} = ${money(expectedValue)}`,
    result: null,
  });

  // ── Cost threshold ──
  trace.push({
    step: 'Cost threshold',
    detail: `${money(P.cost)} × ${P.margin.toFixed(1)}× = ${money(threshold)}`,
    result: null,
  });

  // ── Escalation checks ──
  const escalationReasons = [];

  if (dispute.a > P.limit) {
    escalationReasons.push(
      `Amount ${money(dispute.a)} exceeds the ${money(P.limit)} auto-approval limit.`,
    );
    trace.push({
      step: 'Amount check',
      detail: `${money(dispute.a)} > ${money(P.limit)} limit`,
      result: 'ESCALATE',
    });
  }

  if (confidence < P.conf / 100) {
    const confDetail = `Confidence ${pct(confidence)} is below the ${P.conf}% minimum` +
      (dispute.conflict ? ', and the evidence conflicts.' : '.');
    escalationReasons.push(confDetail);
    trace.push({
      step: 'Confidence check',
      detail: confDetail,
      result: 'ESCALATE',
    });
  }

  if (escalationReasons.length > 0) {
    out = 'ESCALATE';
    why = [...escalationReasons, 'A human receives a brief with every evidence grade.'];
    trace.push({
      step: 'Final decision',
      detail: `${escalationReasons.length} escalation trigger(s) fired`,
      result: 'ESCALATE',
    });
    return { p: winProb, c: confidence, ev: expectedValue, th: threshold, out, why, fields, trace, policy: { ...P } };
  }

  // ── Challenge vs Accept ──
  if (expectedValue > threshold) {
    out = 'CHALLENGE';
    why = [
      `Expected recovery of ${money(expectedValue)} beats the ${money(threshold)} cost threshold, ` +
      `and confidence of ${pct(confidence)} clears the ${P.conf}% minimum. ` +
      `The agent attaches the evidence below.`,
    ];
    trace.push({
      step: 'Value comparison',
      detail: `${money(expectedValue)} > ${money(threshold)} → challenge is profitable`,
      result: 'CHALLENGE',
    });
  } else {
    out = 'ACCEPT';
    why = [
      `Expected recovery of ${money(expectedValue)} is below the ${money(threshold)} cost threshold, ` +
      `so fighting is not worth it.`,
    ];
    trace.push({
      step: 'Value comparison',
      detail: `${money(expectedValue)} ≤ ${money(threshold)} → not worth fighting`,
      result: 'ACCEPT',
    });
  }

  return { p: winProb, c: confidence, ev: expectedValue, th: threshold, out, why, fields, trace, policy: { ...P } };
}

// ─── Net outcome calculator ─────────────────────────────────────────────────

/**
 * Calculate the net financial outcome of an action on a dispute.
 * accept:    lose the full disputed amount
 * challenge: pay the cost; if win=1 recover, if win=0 lose amount + cost
 *
 * @param {{ a: number, win: number }} dispute
 * @param {'accept'|'challenge'} action
 * @param {Policy} policy
 * @returns {number}
 */
export function net(dispute, action, policy) {
  const P = clampPolicy(policy);
  if (action === 'accept') return dispute.a === 0 ? 0 : -dispute.a;
  // challenge
  return (dispute.win ? 0 : -dispute.a) - P.cost;
}

// ─── Flip-hint generator ────────────────────────────────────────────────────

/**
 * Suggest what policy change would flip the current decision.
 *
 * @param {{ a: number, ev: Array, merch?: number, conflict?: number }} dispute
 * @param {Policy} policy
 * @returns {string|null}  Human-readable hint, or null if not applicable.
 */
export function flipHint(dispute, policy) {
  const P = clampPolicy(policy);
  const result = decide(dispute, P);

  if (dispute.merch) {
    return 'This is a merchant error — the decision is always Accept regardless of policy.';
  }

  if (result.out === 'ESCALATE') {
    const hints = [];
    if (dispute.a > P.limit) {
      hints.push(`Raise the auto-approval limit above ${money(dispute.a)} to stop the amount trigger.`);
    }
    if (result.c < P.conf / 100) {
      const neededConf = Math.floor(result.c * 100);
      if (neededConf >= 30) {
        hints.push(`Lower minimum confidence to ${neededConf}% or below to clear the confidence trigger.`);
      } else {
        hints.push('Evidence confidence is too low — no policy change alone can clear it.');
      }
    }
    return hints.join(' ') || null;
  }

  if (result.out === 'CHALLENGE') {
    // To flip to Accept: raise cost threshold above expected value
    // threshold > ev  →  cost * margin > ev  →  cost > ev / margin
    const neededCost = Math.ceil(result.ev / P.margin);
    return `Raise "Cost to fight" above ${money(neededCost)} to flip this to Accept.`;
  }

  if (result.out === 'ACCEPT' && !dispute.merch) {
    // To flip to Challenge: lower threshold below expected value
    // cost * margin < ev  →  cost < ev / margin
    const neededCost = Math.floor(result.ev / P.margin);
    if (neededCost < 5) {
      return 'Expected recovery is too low — even a $5 cost threshold would not flip this to Challenge.';
    }
    return `Lower "Cost to fight" below ${money(neededCost)} to flip this to Challenge.`;
  }

  return null;
}

// ─── Escalation brief generator ─────────────────────────────────────────────

/**
 * Generate a human-readable escalation brief for disputes that need review.
 *
 * @param {{ t: string, a: number, n: string, ev: Array, d: number, conflict?: number }} dispute
 * @param {Policy} policy
 * @returns {{ summary: string, strongestEvidence: string|null, weakestEvidence: string|null, missingEvidence: string[], recommendedAction: string }}
 */
export function generateEscalationBrief(dispute, policy) {
  const result = decide(dispute, policy);
  const sorted = [...dispute.ev].sort((a, b) => b[1] - a[1]);

  const strongest = sorted.length > 0
    ? `${sorted[0][0]} (strength ${pct(sorted[0][1])}, confidence ${pct(sorted[0][2])})`
    : null;

  const weakest = sorted.length > 1
    ? `${sorted[sorted.length - 1][0]} (strength ${pct(sorted[sorted.length - 1][1])}, confidence ${pct(sorted[sorted.length - 1][2])})`
    : null;

  // Check for commonly expected evidence types that are missing
  const commonTypes = [
    'order_fulfillment_file_ids',
    'customer_communication_file_ids',
    'order_snapshot_file_ids',
    'access_activity_file_ids',
  ];
  const presentTypes = new Set(dispute.ev.map((e) => e[4]));
  const missingEvidence = commonTypes
    .filter((t) => !presentTypes.has(t))
    .map((t) => t.replace(/_file_ids$/, '').replace(/_/g, ' '));

  let recommendedAction;
  if (result.ev > result.th && result.c >= (policy.conf || 60) / 100) {
    recommendedAction = 'Challenge — evidence supports it but amount or confidence triggered escalation.';
  } else if (dispute.conflict) {
    recommendedAction = 'Investigate further — conflicting evidence needs manual review.';
  } else {
    recommendedAction = 'Accept — the evidence is unlikely to win this dispute.';
  }

  const daysWarning = dispute.d <= 3
    ? ` ⚠️ Only ${dispute.d} day${dispute.d === 1 ? '' : 's'} left to respond.`
    : '';

  return {
    summary: `${dispute.t}: ${money(dispute.a)} dispute. ${dispute.n}` +
      ` Win probability ${pct(result.p)}, confidence ${pct(result.c)}.${daysWarning}`,
    strongestEvidence: strongest,
    weakestEvidence: weakest,
    missingEvidence,
    recommendedAction,
  };
}

// ─── Legacy aliases (keep old imports working during migration) ──────────────

export const PD = DEFAULT_POLICY;
export const PF = POLICY_FIELDS;
export const m = money;
export const pc = pct;
