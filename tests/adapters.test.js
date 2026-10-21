import { describe, it, expect } from 'vitest';
import * as simulatorAdapter from '../src/adapters/simulatorAdapter.js';
import { getAdapter, getModeName } from '../src/adapters/index.js';

describe('Simulator Adapter', () => {
  it('lists all demo disputes mapped to Airwallex shape', async () => {
    const disputes = await simulatorAdapter.listDisputes();
    expect(disputes).toHaveLength(5);

    const first = disputes[0];
    expect(first.id).toBe('dp_demo_001');
    expect(first.dispute_amount).toBe(640);
    expect(first.dispute_currency).toBe('USD');
    expect(first.reason_code).toBe('Product not received');
    expect(first.status).toBe('pending_response');
    expect(first).toHaveProperty('created_at');
    expect(first).toHaveProperty('respond_by');
    expect(first).toHaveProperty('payment_intent_id');
    expect(Array.isArray(first.evidence_files)).toBe(true);
    expect(first.evidence_files.length).toBe(3);
    expect(first._raw).toBeDefined();
  });

  it('gets a single dispute by ID', async () => {
    const dispute = await simulatorAdapter.getDispute('dp_demo_002');
    expect(dispute).not.toBeNull();
    expect(dispute.id).toBe('dp_demo_002');
    expect(dispute.dispute_amount).toBe(180);
  });

  it('returns null for unknown dispute ID', async () => {
    const dispute = await simulatorAdapter.getDispute('unknown_id');
    expect(dispute).toBeNull();
  });

  it('accepts a dispute as dry-run and enforces idempotency', async () => {
    const id = 'dp_demo_003';
    const res1 = await simulatorAdapter.acceptDispute(id);
    expect(res1.success).toBe(true);
    expect(res1.disputeId).toBe(id);
    expect(res1.action).toBe('accept');
    expect(res1.dryRun).toBe(true);
    expect(res1.timestamp).toBeDefined();

    // Idempotency check: second action on same dispute should return alreadyActioned
    const res2 = await simulatorAdapter.acceptDispute(id);
    expect(res2.alreadyActioned).toBe(true);

    const res3 = await simulatorAdapter.challengeDispute(id, ['field_1']);
    expect(res3.alreadyActioned).toBe(true);
  });

  it('challenges a dispute with evidence and enforces idempotency', async () => {
    const id = 'dp_demo_001';
    const evidence = ['order_fulfillment_file_ids', 'customer_communication_file_ids'];
    const res1 = await simulatorAdapter.challengeDispute(id, evidence);
    expect(res1.success).toBe(true);
    expect(res1.disputeId).toBe(id);
    expect(res1.action).toBe('challenge');
    expect(res1.evidence).toEqual(evidence);
    expect(res1.dryRun).toBe(true);

    // Second action fails idempotently
    const res2 = await simulatorAdapter.challengeDispute(id, evidence);
    expect(res2.alreadyActioned).toBe(true);
  });
});

describe('Adapter Factory', () => {
  it('returns simulator adapter by default', () => {
    const adapter = getAdapter();
    expect(adapter).toBeDefined();
    expect(typeof adapter.listDisputes).toBe('function');
    expect(typeof adapter.getDispute).toBe('function');
    expect(typeof adapter.acceptDispute).toBe('function');
    expect(typeof adapter.challengeDispute).toBe('function');
  });

  it('returns simulator mode name by default', () => {
    expect(getModeName()).toBe('simulator');
  });
});
