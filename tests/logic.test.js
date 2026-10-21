/**
 * DisputeIQ — Unit tests for src/logic.js
 *
 * Run with:  npm test
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_POLICY,
  POLICY_FIELDS,
  money,
  pct,
  clampPolicy,
  validatePolicy,
  decide,
  net,
  flipHint,
  generateEscalationBrief,
} from '../src/logic.js';
import { DISPUTES } from '../src/data.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Shortcut to grab a demo dispute by ID */
const byId = (id) => DISPUTES.find((d) => d.id === id);

// ─────────────────────────────────────────────────────────────────────────────
// 1. decide() — all 5 demo disputes with default policy
// ─────────────────────────────────────────────────────────────────────────────

describe('decide() — demo disputes (default policy)', () => {
  it('dp_demo_001 (product not received, $640, good evidence) → CHALLENGE', () => {
    const r = decide(byId('dp_demo_001'), DEFAULT_POLICY);
    expect(r.out).toBe('CHALLENGE');
    expect(r.p).toBeGreaterThan(0.5);
    expect(r.c).toBeGreaterThan(DEFAULT_POLICY.conf / 100);
    expect(r.ev).toBeGreaterThan(r.th);
  });

  it('dp_demo_002 (digital product, $180, good evidence) → CHALLENGE', () => {
    const r = decide(byId('dp_demo_002'), DEFAULT_POLICY);
    expect(r.out).toBe('CHALLENGE');
    expect(r.ev).toBeGreaterThan(r.th);
  });

  it('dp_demo_003 (subscription $12, low amount) → ACCEPT (expected value below threshold)', () => {
    const r = decide(byId('dp_demo_003'), DEFAULT_POLICY);
    expect(r.out).toBe('ACCEPT');
    // Expected value should be below the cost threshold
    expect(r.ev).toBeLessThanOrEqual(r.th);
  });

  it('dp_demo_004 (duplicate charge, merch=1) → ACCEPT (merchant error override)', () => {
    const r = decide(byId('dp_demo_004'), DEFAULT_POLICY);
    expect(r.out).toBe('ACCEPT');
    // Should have early-return trace with merchant error
    expect(r.trace.some((s) => s.step === 'Merchant error flag')).toBe(true);
  });

  it('dp_demo_005 (fraud $4800, conflict=1) → ESCALATE (over limit + low confidence)', () => {
    const r = decide(byId('dp_demo_005'), DEFAULT_POLICY);
    expect(r.out).toBe('ESCALATE');
    // Amount exceeds default limit of $2000
    expect(byId('dp_demo_005').a).toBeGreaterThan(DEFAULT_POLICY.limit);
    // Confidence should be below minimum after 40% conflict reduction
    expect(r.c).toBeLessThan(DEFAULT_POLICY.conf / 100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. decide() — edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('decide() — edge cases', () => {
  // Build a synthetic dispute with tunable amount and clear evidence
  const mkDispute = (a, { conflict = 0, merch = 0, winProb = 0.9, conf = 0.85 } = {}) => ({
    a,
    ev: [['Test evidence', winProb, conf, 3, 'order_fulfillment_file_ids']],
    conflict,
    merch,
  });

  it('amount exactly at the limit ($2000) should NOT escalate on amount alone', () => {
    const r = decide(mkDispute(2000), DEFAULT_POLICY);
    // 2000 is NOT > 2000, so amount trigger should not fire
    expect(r.out).not.toBe('ESCALATE');
  });

  it('amount $1 above limit ($2001) should trigger escalation', () => {
    const r = decide(mkDispute(2001), DEFAULT_POLICY);
    expect(r.out).toBe('ESCALATE');
    expect(r.why.some((s) => s.includes('auto-approval limit'))).toBe(true);
  });

  it('confidence exactly at minimum (60% = 0.6) should NOT escalate on confidence alone', () => {
    // conf / 100 = 0.60, and our evidence confidence is exactly 0.60
    const d = mkDispute(500, { conf: 0.6 });
    const r = decide(d, DEFAULT_POLICY);
    // 0.6 is NOT < 0.6, so confidence trigger should not fire
    expect(r.out).not.toBe('ESCALATE');
  });

  it('confidence just below minimum should escalate', () => {
    // 0.59 < 0.60 threshold
    const d = mkDispute(500, { conf: 0.59 });
    const r = decide(d, DEFAULT_POLICY);
    expect(r.out).toBe('ESCALATE');
  });

  it('zero cost policy (cost=5, minimum allowed) → more disputes become challenges', () => {
    const lowCost = { ...DEFAULT_POLICY, cost: 5 };
    // dp_demo_003 ($12 subscription) is ACCEPT with default policy; with cost=5 the
    // threshold drops to 5*1.2=6, so expected value ~$8 > 6 → CHALLENGE
    const r = decide(byId('dp_demo_003'), lowCost);
    expect(r.th).toBe(5 * lowCost.margin);
    expect(r.out).toBe('CHALLENGE');
  });

  it('merchant error override ignores all other scoring rules', () => {
    // Even a high-value dispute with great evidence is accepted when merch=1
    const d = mkDispute(10000, { merch: 1, winProb: 0.99, conf: 0.99 });
    const r = decide(d, DEFAULT_POLICY);
    expect(r.out).toBe('ACCEPT');
  });

  it('conflicting evidence reduces confidence by 40%', () => {
    const noConflict = decide(mkDispute(500, { conf: 0.8 }), DEFAULT_POLICY);
    const withConflict = decide(mkDispute(500, { conflict: 1, conf: 0.8 }), DEFAULT_POLICY);
    // 0.8 * 0.6 = 0.48
    expect(withConflict.c).toBeCloseTo(noConflict.c * 0.6, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. net() function
// ─────────────────────────────────────────────────────────────────────────────

describe('net()', () => {
  const pol = DEFAULT_POLICY;

  it('accept always returns -amount', () => {
    expect(net({ a: 100, win: 1 }, 'accept', pol)).toBe(-100);
    expect(net({ a: 640, win: 0 }, 'accept', pol)).toBe(-640);
    expect(net({ a: 0, win: 1 }, 'accept', pol)).toBe(0);
  });

  it('challenge with win=1 returns -cost', () => {
    expect(net({ a: 640, win: 1 }, 'challenge', pol)).toBe(-pol.cost);
  });

  it('challenge with win=0 returns -(amount + cost)', () => {
    expect(net({ a: 640, win: 0 }, 'challenge', pol)).toBe(-(640 + pol.cost));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. money() and pct() formatters
// ─────────────────────────────────────────────────────────────────────────────

describe('money()', () => {
  it('formats normal values', () => {
    expect(money(0)).toBe('$0');
    expect(money(5)).toBe('$5');
    expect(money(1234)).toBe('$1,234');
    expect(money(1000000)).toBe('$1,000,000');
  });

  it('formats negative values with −', () => {
    expect(money(-500)).toBe('−$500');
    expect(money(-1234)).toBe('−$1,234');
  });

  it('handles zero', () => {
    expect(money(0)).toBe('$0');
  });

  it('handles NaN → $0', () => {
    expect(money(NaN)).toBe('$0');
    expect(money(undefined)).toBe('$0');
    expect(money('abc')).toBe('$0');
  });
});

describe('pct()', () => {
  it('formats normal 0-1 values as percentages', () => {
    expect(pct(0)).toBe('0%');
    expect(pct(0.5)).toBe('50%');
    expect(pct(1)).toBe('100%');
    expect(pct(0.853)).toBe('85%');
  });

  it('handles negative values', () => {
    expect(pct(-0.25)).toBe('-25%');
  });

  it('handles NaN → 0%', () => {
    expect(pct(NaN)).toBe('0%');
    expect(pct(undefined)).toBe('0%');
    expect(pct('hello')).toBe('0%');
  });
});

describe('POLICY_FIELDS', () => {
  it('defines 4 policy fields with min, max, step, and formatter', () => {
    expect(POLICY_FIELDS).toHaveLength(4);
    const keys = POLICY_FIELDS.map(([k]) => k);
    expect(keys).toEqual(['cost', 'margin', 'limit', 'conf']);
    for (const [, label, min, max, step, fmt] of POLICY_FIELDS) {
      expect(typeof label).toBe('string');
      expect(typeof min).toBe('number');
      expect(typeof max).toBe('number');
      expect(typeof step).toBe('number');
      expect(typeof fmt).toBe('function');
      expect(min).toBeLessThan(max);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. clampPolicy()
// ─────────────────────────────────────────────────────────────────────────────

describe('clampPolicy()', () => {
  it('passes through valid values unchanged', () => {
    const valid = { cost: 50, margin: 2.0, limit: 5000, conf: 70 };
    expect(clampPolicy(valid)).toEqual(valid);
  });

  it('clamps out-of-range values', () => {
    const out = clampPolicy({ cost: 999, margin: 0.1, limit: 1, conf: 100 });
    expect(out.cost).toBe(100);        // max 100
    expect(out.margin).toBe(1);        // min 1
    expect(out.limit).toBe(500);       // min 500
    expect(out.conf).toBe(90);         // max 90
  });

  it('rejects NaN (falls back to defaults)', () => {
    const out = clampPolicy({ cost: NaN, margin: NaN, limit: NaN, conf: NaN });
    expect(out).toEqual(DEFAULT_POLICY);
  });

  it('handles null/undefined input → all defaults', () => {
    expect(clampPolicy(null)).toEqual(DEFAULT_POLICY);
    expect(clampPolicy(undefined)).toEqual(DEFAULT_POLICY);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. validatePolicy()
// ─────────────────────────────────────────────────────────────────────────────

describe('validatePolicy()', () => {
  it('returns empty array for valid policy', () => {
    expect(validatePolicy(DEFAULT_POLICY)).toEqual([]);
    expect(validatePolicy({ cost: 50, margin: 2.0, limit: 5000, conf: 70 })).toEqual([]);
  });

  it('returns error messages for out-of-range values', () => {
    const errors = validatePolicy({ cost: 999, margin: -1, limit: 99999, conf: 100 });
    expect(errors.length).toBe(4);
    errors.forEach((msg) => {
      expect(msg).toContain('must be between');
    });
  });

  it('returns error messages for NaN', () => {
    const errors = validatePolicy({ cost: NaN, margin: NaN, limit: NaN, conf: NaN });
    expect(errors.length).toBe(4);
    errors.forEach((msg) => {
      expect(msg).toContain('must be a number');
    });
  });

  it('returns per-field error for partial bad input', () => {
    const errors = validatePolicy({ cost: 50, margin: 2.0, limit: 'bad', conf: 70 });
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('Auto-approval limit');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. flipHint()
// ─────────────────────────────────────────────────────────────────────────────

describe('flipHint()', () => {
  it('returns hint for CHALLENGE decisions (how to flip to Accept)', () => {
    const hint = flipHint(byId('dp_demo_001'), DEFAULT_POLICY);
    expect(hint).toContain('Cost to fight');
    expect(hint).toContain('Accept');
  });

  it('returns hint for ACCEPT decisions (how to flip to Challenge)', () => {
    const hint = flipHint(byId('dp_demo_003'), DEFAULT_POLICY);
    expect(hint).toBeTruthy();
    // Should mention lowering cost or that it's too low
    expect(hint).toMatch(/Cost to fight|too low/);
  });

  it('returns hint for ESCALATE decisions', () => {
    const hint = flipHint(byId('dp_demo_005'), DEFAULT_POLICY);
    expect(hint).toBeTruthy();
    // Should mention the auto-approval limit and/or confidence
    expect(hint).toMatch(/auto-approval limit|confidence/i);
  });

  it('returns special message for merchant errors', () => {
    const hint = flipHint(byId('dp_demo_004'), DEFAULT_POLICY);
    expect(hint).toContain('merchant error');
    expect(hint).toContain('always Accept');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. generateEscalationBrief()
// ─────────────────────────────────────────────────────────────────────────────

describe('generateEscalationBrief()', () => {
  const dispute = byId('dp_demo_005');
  const brief = generateEscalationBrief(dispute, DEFAULT_POLICY);

  it('returns correct structure', () => {
    expect(brief).toHaveProperty('summary');
    expect(brief).toHaveProperty('strongestEvidence');
    expect(brief).toHaveProperty('weakestEvidence');
    expect(brief).toHaveProperty('missingEvidence');
    expect(brief).toHaveProperty('recommendedAction');
    expect(typeof brief.summary).toBe('string');
    expect(Array.isArray(brief.missingEvidence)).toBe(true);
  });

  it('identifies strongest and weakest evidence', () => {
    // dp_demo_005 evidence: 3-D Secure (0.20), Previous purchase (0.50), Billing vs (0.30)
    // Strongest by win-probability: Previous purchase (0.50)
    expect(brief.strongestEvidence).toContain('Previous purchase');
    // Weakest: 3-D Secure (0.20)
    expect(brief.weakestEvidence).toContain('3-D Secure');
  });

  it('lists missing evidence types', () => {
    // dp_demo_005 has: authenticity_proof_file_ids, previous_purchase_similar_product_file_ids, order_snapshot_file_ids
    // Missing from commonTypes: order_fulfillment, customer_communication, access_activity
    expect(brief.missingEvidence).toContain('order fulfillment');
    expect(brief.missingEvidence).toContain('customer communication');
    expect(brief.missingEvidence).toContain('access activity');
    // order_snapshot IS present, so it should NOT be listed
    expect(brief.missingEvidence).not.toContain('order snapshot');
  });

  it('includes amount and dispute type in summary', () => {
    expect(brief.summary).toContain('$4,800');
    expect(brief.summary).toContain('Fraud claim');
  });

  it('includes days-left warning when d <= 3', () => {
    // dp_demo_005 has d=3
    expect(brief.summary).toContain('⚠️');
    expect(brief.summary).toContain('3 days');
  });

  it('does NOT include days-left warning when d > 3', () => {
    const d1 = byId('dp_demo_001'); // d=9
    const b1 = generateEscalationBrief(d1, DEFAULT_POLICY);
    expect(b1.summary).not.toContain('⚠️');
  });
});
