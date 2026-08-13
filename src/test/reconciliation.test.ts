import test from 'node:test'; import assert from 'node:assert/strict';
import { ReconciliationService, order } from '../engine.js'; import { Store } from '../store.js'; import { fixture } from '../fixtures.js';
const kitchen = fixture.kitchen.map(([externalId, orderRef]) => ({ source: 'kitchen', externalId, orderRef, cookedAt: `${fixture.date}T18:00:00.000Z` }));
const service = (name: string) => { const store = new Store(`/tmp/${name}.json`); store.reset(); return new ReconciliationService(store); };

test('close is an immutable financial and exception snapshot; late evidence only appends linked components', () => {
  const svc = service('reconciliation-close'); svc.ingestOrders(fixture.orders); svc.ingestKitchen(kitchen);
  const close = svc.close(fixture.date); const frozen = JSON.stringify(close);
  svc.ingestSettlements(fixture.settlements); const adjustments = svc.adjust();
  assert.equal(JSON.stringify(svc.list().closes[0]), frozen);
  assert.deepEqual(adjustments.map(x => [x.component, x.amount, x.reason]).sort(), [['commission', 50, 'COMMISSION_MISMATCH'], ['discount', -50, 'DISCOUNT_MISMATCH']]);
  assert.ok(adjustments.every(x => x.closeId === close.id && x.orderId && x.settlementId));
  assert.ok(close.exceptionSnapshot.length > 0); assert.notEqual(close.exceptionSnapshot, svc.list().exceptions);
});

test('raw ingestion is idempotent and conflicting replays never overwrite the accepted order', () => {
  const svc = service('reconciliation-idempotency'); const row = fixture.orders[0];
  assert.deepEqual(svc.ingestOrders([row]), { accepted: 1, ignored: 0 });
  assert.deepEqual(svc.ingestOrders([row]), { accepted: 0, ignored: 1 });
  svc.ingestOrders([{ ...row, money: { ...row.money, paid: 1 } }]);
  assert.equal(svc.list().orders.length, 1); assert.equal(svc.list().orders[0].money.paid, 1200);
  assert.equal(svc.list().sourceRecords.length, 1);
  assert.ok(svc.list().exceptions.some(x => x.reason === 'SOURCE_RECORD_CONFLICT'));
});

test('similar cross-feed records are review-only while a shared merchant reference is strong evidence', () => {
  const svc = service('reconciliation-matching');
  svc.ingestOrders([
    order('app', 'A-1', 'app', fixture.date, 'Same customer', '10:00', { gross: 500, platformDiscount: 0, commission: 0, paid: 500 }),
    order('agg1', 'G-1', 'agg1', fixture.date, 'Same customer', '10:03', { gross: 500, platformDiscount: 0, commission: 50, paid: 450 }),
    order('pos', 'P-1', 'pos', fixture.date, 'Other customer', '11:00', { gross: 700, platformDiscount: 0, commission: 0, paid: 700 }, 'paid', 'merchant-1'),
    order('app', 'A-2', 'app', fixture.date, 'Other customer', '11:02', { gross: 700, platformDiscount: 0, commission: 0, paid: 700 }, 'paid', 'merchant-1')
  ]);
  const report = svc.reconcile(fixture.date);
  assert.equal(svc.list().orders.length, 4);
  assert.equal(report.exceptions.filter(x => x.reason === 'AMBIGUOUS_DUPLICATE').length, 2);
  assert.equal(report.orders, 3);
  assert.equal(report.revenue, 1200);
});

test('a settlement that was known before close is reconciled in that close, never appended as a late adjustment', () => {
  const svc = service('reconciliation-known-settlement'); const row = fixture.orders[2];
  svc.ingestOrders([row]); svc.ingestKitchen([{ source: 'kitchen', externalId: 'K-known', orderRef: row.externalId, cookedAt: `${fixture.date}T18:00:00.000Z` }]);
  svc.ingestSettlements([fixture.settlements[0]]); const close = svc.close(fixture.date);
  assert.ok(close.exceptionSnapshot.some(x => x.reason === 'COMMISSION_MISMATCH'));
  assert.deepEqual(svc.adjust(), []);
});

test('pre-close source conflicts are retained in the close exception snapshot', () => {
  const svc = service('reconciliation-conflict-snapshot'); const row = fixture.orders[0];
  svc.ingestOrders([row, { ...row, money: { ...row.money, paid: 1 } }]);
  const close = svc.close(fixture.date);
  assert.ok(close.exceptionSnapshot.some(x => x.reason === 'SOURCE_RECORD_CONFLICT'));
});

test('settlement and kitchen feeds expose unmatched and timing evidence without inventing an adjustment', () => {
  const svc = service('reconciliation-unmatched'); svc.ingestOrders([fixture.orders[0]]);
  svc.ingestKitchen([{ source: 'kitchen', externalId: 'K-lost', orderRef: 'not-an-order', cookedAt: `${fixture.date}T19:00:00.000Z` }]);
  svc.ingestSettlements([{ source: 'agg1', externalId: 'S-lost', orderRef: 'not-an-order', businessDate: fixture.date, settled: 1, commission: 0, platformDiscount: 0, receivedAt: '2026-08-13T12:00:00.000Z' }]);
  const reasons = svc.reconcile(fixture.date).exceptions.map(x => x.reason);
  for (const reason of ['UNMATCHED_KITCHEN', 'UNMATCHED_SETTLEMENT', 'SETTLEMENT_TIMING']) assert.ok(reasons.includes(reason as any));
  svc.close(fixture.date); assert.equal(svc.adjust().length, 0);
});
