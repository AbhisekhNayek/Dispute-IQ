/**
 * DisputeIQ — Demo dispute data
 *
 * These disputes are HAND-LABELLED and ILLUSTRATIVE.
 * They do NOT represent real win rates or real transaction data.
 *
 * Shape mirrors the Airwallex dispute object where possible.
 * Fields: id, t (title/reason), a (amount), d (days remaining),
 *         n (notes), win (labelled outcome), ev (evidence array),
 *         merch (merchant error flag), conflict (conflicting evidence flag)
 *
 * Evidence tuple: [name, strength 0-1, confidence 0-1, weight 1-3, field_id]
 */

export const DISPUTES = [
  {
    id: 'dp_demo_001',
    t: 'Product not received',
    a: 640,
    d: 9,
    n: 'Order A-1042. Carrier shows delivered.',
    win: 1,
    ev: [
      ['Signed delivery confirmation', 0.95, 0.9, 3, 'order_fulfillment_file_ids'],
      ['Carrier tracking log',         0.85, 0.9, 2, 'order_fulfillment_file_ids'],
      ['Customer emails',              0.60, 0.8, 1, 'customer_communication_file_ids'],
    ],
  },
  {
    id: 'dp_demo_002',
    t: 'Digital product, claims unused',
    a: 180,
    d: 12,
    n: 'Annual plan. Customer says they never used it.',
    win: 1,
    ev: [
      ['Account access logs',           0.90, 0.90, 3, 'access_activity_file_ids'],
      ['Product consumption record',    0.80, 0.85, 2, 'product_consumption_file_ids'],
      ['Terms acceptance snapshot',     0.50, 0.80, 1, 'order_snapshot_file_ids'],
    ],
  },
  {
    id: 'dp_demo_003',
    t: 'Subscription renewal dispute',
    a: 12,
    d: 20,
    n: 'Monthly plan. Customer forgot to cancel.',
    win: 1,
    ev: [
      ['Renewal notice email',   0.70, 0.85, 2, 'customer_communication_file_ids'],
      ['Recent account activity', 0.60, 0.80, 1, 'access_activity_file_ids'],
    ],
  },
  {
    id: 'dp_demo_004',
    t: 'Duplicate charge',
    a: 95,
    d: 7,
    n: 'Two identical charges, 41 seconds apart.',
    win: 0,
    merch: 1,
    ev: [
      ['Payment records show two charges', 0.10, 0.95, 3, 'duplicate_payment_file_ids'],
      ['No second order exists',           0.10, 0.90, 2, 'order_snapshot_file_ids'],
    ],
  },
  {
    id: 'dp_demo_005',
    t: 'Fraud claim, high value',
    a: 4800,
    d: 3,
    n: 'New customer, express shipping, billing and shipping addresses differ.',
    win: 0,
    conflict: 1,
    ev: [
      ['3-D Secure authentication',             0.20, 0.50, 3, 'authenticity_proof_file_ids'],
      ['Previous purchase of similar product',   0.50, 0.40, 2, 'previous_purchase_similar_product_file_ids'],
      ['Billing vs. shipping address',           0.30, 0.50, 1, 'order_snapshot_file_ids'],
    ],
  },
];

/** @deprecated Use DISPUTES instead. Kept for backwards compatibility during migration. */
export const D = DISPUTES;
