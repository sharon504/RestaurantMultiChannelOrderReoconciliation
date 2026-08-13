import { Adjustment, Channel, Close, Exception, Kitchen, Money, Order, Reason, Settlement, SourceRecord, id } from './domain.js';
import { Store } from './store.js';

const now = () => new Date().toISOString();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const stable = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : item);
const dayDifference = (from: string, to: string) => Math.round((Date.parse(to.slice(0, 10) + 'T00:00:00.000Z') - Date.parse(from + 'T00:00:00.000Z')) / 86_400_000);

export class ReconciliationService {
  constructor(public store = new Store()) {}

  /** Records raw input before normalization. Same key + same payload is a no-op; a changed payload is evidence, not an overwrite. */
  private acceptRaw(kind: SourceRecord['kind'], source: string, externalId: string, payload: unknown): boolean {
    const record: SourceRecord = { id: id(`raw_${kind}`, source, externalId), kind, source, externalId, payload: stable(payload), ingestedAt: now(), sequence: this.store.data.sourceRecords.length + 1 };
    const existing = this.store.data.sourceRecords.find(x => x.id === record.id);
    if (!existing) { this.store.data.sourceRecords.push(record); return true; }
    if (existing.payload !== record.payload) {
      this.recordException({ date: this.dateFor(payload), reason: 'SOURCE_RECORD_CONFLICT', sourceIds: [existing.id], detail: `Conflicting replay for ${kind}:${source}/${externalId}; original retained` });
    }
    return false;
  }

  private dateFor(value: unknown): string {
    const item = value as { businessDate?: string; cookedAt?: string };
    return item.businessDate ?? item.cookedAt?.slice(0, 10) ?? 'unknown';
  }

  ingestOrders(rows: Omit<Order, 'id' | 'ingestedAt'>[]) {
    let accepted = 0;
    for (const row of rows) if (this.acceptRaw('order', row.source, row.externalId, row)) {
      this.store.data.orders.push({ ...row, id: id('order', row.source, row.externalId), ingestedAt: now() }); accepted++;
    }
    this.store.save(); return { accepted, ignored: rows.length - accepted };
  }
  ingestKitchen(rows: Omit<Kitchen, 'id' | 'ingestedAt'>[]) {
    let accepted = 0;
    for (const row of rows) if (this.acceptRaw('kitchen', row.source, row.externalId, row)) {
      this.store.data.kitchens.push({ ...row, id: id('kitchen', row.source, row.externalId), ingestedAt: now() }); accepted++;
    }
    this.store.save(); return { accepted, ignored: rows.length - accepted };
  }
  ingestSettlements(rows: Omit<Settlement, 'id'>[]) {
    let accepted = 0;
    for (const row of rows) if (this.acceptRaw('settlement', row.source, row.externalId, row)) {
      this.store.data.settlements.push({ ...row, id: id('settlement', row.source, row.externalId) }); accepted++;
    }
    this.store.save(); return { accepted, ignored: rows.length - accepted };
  }

  private recordException(input: Omit<Exception, 'id' | 'createdAt'>): Exception {
    const sourceKey = input.sourceIds.join('_');
    const exception: Exception = { ...input, id: id('exception', input.reason, `${input.date}_${sourceKey}`), createdAt: now() };
    const existing = this.store.data.exceptions.find(x => x.id === exception.id);
    if (existing) return existing;
    this.store.data.exceptions.push(exception); return exception;
  }
  private add(out: Exception[], input: Omit<Exception, 'id' | 'createdAt'>) { out.push(this.recordException(input)); }
  /** A canonical reference is a merchant-issued identity. Pick one deterministic accounting
   * representative, but retain every source row as immutable audit evidence. */
  private primaryOrder(orders: Order[]): Order | undefined {
    return [...orders].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.source.localeCompare(b.source) || a.externalId.localeCompare(b.externalId))[0];
  }
  private aliasesFor(order: Order): Order[] {
    return order.canonicalRef ? this.store.data.orders.filter(x => x.canonicalRef === order.canonicalRef) : [order];
  }
  private effectiveOrders(date: string): Order[] {
    const seen = new Set<string>();
    return this.store.data.orders.filter(x => x.businessDate === date).filter(order => {
      const key = order.canonicalRef ? `canonical:${order.canonicalRef}` : `source:${order.id}`;
      if (seen.has(key)) return false;
      seen.add(key); return this.primaryOrder(this.aliasesFor(order))?.id === order.id;
    });
  }
  private orderFor(ref: string): Order | undefined {
    const candidates = this.store.data.orders.filter(x => x.externalId === ref || x.id === ref || x.canonicalRef === ref);
    return this.primaryOrder(candidates);
  }
  private kitchensFor(order: Order) {
    const references = new Set(this.aliasesFor(order).flatMap(x => [x.externalId, x.id, ...(x.canonicalRef ? [x.canonicalRef] : [])]));
    return this.store.data.kitchens.filter(x => references.has(x.orderRef));
  }
  private settlementFor(order: Order, date: string) {
    const references = new Set(this.aliasesFor(order).flatMap(x => [x.externalId, x.id, ...(x.canonicalRef ? [x.canonicalRef] : [])]));
    return this.store.data.settlements.find(x => x.businessDate === date && references.has(x.orderRef));
  }
  private settlementWasInClose(settlement: Settlement, close: Close): boolean {
    const raw = this.store.data.sourceRecords.find(x => x.id === id('raw_settlement', settlement.source, settlement.externalId));
    return !!raw && raw.sequence <= close.sourceRecordSequence;
  }

  exceptions(date: string) {
    const orders = this.effectiveOrders(date); const out: Exception[] = [];
    for (const order of orders) {
      const kitchens = this.kitchensFor(order); const settlement = this.settlementFor(order, date);
      if (kitchens.length && order.money.paid === 0) this.add(out, { date, reason: 'COOKED_UNPAID', orderId: order.id, kitchenId: kitchens[0].id, sourceIds: [order.id, kitchens[0].id], detail: 'Kitchen confirms preparation but the order has no payment.' });
      if (!kitchens.length && order.money.paid > 0 && order.status === 'paid') this.add(out, { date, reason: 'PAID_UNCOOKED', orderId: order.id, sourceIds: [order.id], detail: 'Paid order has no kitchen confirmation.' });
      if (kitchens.length && order.status === 'cancelled') this.add(out, { date, reason: 'CANCELLED_AFTER_COOKING', orderId: order.id, kitchenId: kitchens[0].id, sourceIds: [order.id, kitchens[0].id], detail: 'Cancelled order was already prepared.' });
      // A strong merchant reference is the only auto-match. Similar records are retained and explicitly reviewable.
      const similar = orders.filter(x => x.id !== order.id && x.customer === order.customer && x.money.gross === order.money.gross && Math.abs(Date.parse(x.occurredAt) - Date.parse(order.occurredAt)) <= 5 * 60_000 && !(order.canonicalRef && order.canonicalRef === x.canonicalRef));
      if (similar.length) this.add(out, { date, reason: 'AMBIGUOUS_DUPLICATE', orderId: order.id, sourceIds: [order.id, ...similar.map(x => x.id)], detail: 'Similar customer/time/value records have no shared strong merchant reference; none were merged.' });
      if (settlement) {
        if (settlement.commission !== order.money.commission) this.add(out, { date, reason: 'COMMISSION_MISMATCH', orderId: order.id, settlementId: settlement.id, sourceIds: [order.id, settlement.id], detail: `Commission close=${order.money.commission} settlement=${settlement.commission}.` });
        if (settlement.platformDiscount !== order.money.platformDiscount) this.add(out, { date, reason: 'DISCOUNT_MISMATCH', orderId: order.id, settlementId: settlement.id, sourceIds: [order.id, settlement.id], detail: `Platform discount close=${order.money.platformDiscount} settlement=${settlement.platformDiscount}.` });
      }
    }
    for (const kitchen of this.store.data.kitchens.filter(k => k.cookedAt.slice(0, 10) === date && !this.orderFor(k.orderRef))) this.add(out, { date, reason: 'UNMATCHED_KITCHEN', kitchenId: kitchen.id, sourceIds: [kitchen.id], detail: 'Kitchen confirmation has no strong order reference.' });
    for (const settlement of this.store.data.settlements.filter(s => s.businessDate === date)) {
      const order = this.orderFor(settlement.orderRef);
      if (!order) this.add(out, { date, reason: 'UNMATCHED_SETTLEMENT', settlementId: settlement.id, sourceIds: [settlement.id], detail: 'Settlement row has no matching order.' });
      if (dayDifference(date, settlement.receivedAt) !== 2) this.add(out, { date, reason: 'SETTLEMENT_TIMING', orderId: order?.id, settlementId: settlement.id, sourceIds: [settlement.id, ...(order ? [order.id] : [])], detail: `Settlement arrived T+${dayDifference(date, settlement.receivedAt)}, expected T+2.` });
    }
    // Include prior ingestion evidence in a report and close snapshot even when it was
    // discovered before reconciliation (for example a conflicting source replay).
    const persisted = this.store.data.exceptions.filter(x => x.date === date);
    this.store.save(); return persisted.filter((value, index, all) => all.findIndex(x => x.id === value.id) === index);
  }

  reconcile(date: string) {
    const exceptions = this.exceptions(date); const orders = this.effectiveOrders(date);
    const total = (field: (order: Order) => number) => orders.reduce((sum, order) => sum + field(order), 0);
    return { date, orders: orders.length, gross: total(x => x.money.gross), platformDiscount: total(x => x.money.platformDiscount), commission: total(x => x.money.commission), paid: total(x => x.money.paid), revenue: total(x => x.money.paid - x.money.commission), exceptions };
  }
  close(date: string): Close {
    const existing = this.store.data.closes.find(x => x.date === date); if (existing) return existing;
    const report = this.reconcile(date); const close: Close = { id: id('close', 'day', date), date, createdAt: now(), orderIds: this.effectiveOrders(date).map(x => x.id), revenue: report.revenue, gross: report.gross, platformDiscount: report.platformDiscount, commission: report.commission, paid: report.paid, exceptionIds: report.exceptions.map(x => x.id), sourceRecordSequence: this.store.data.sourceRecords.length, exceptionSnapshot: clone(report.exceptions) };
    this.store.data.closes.push(close); this.store.save(); return close;
  }
  adjust() {
    const made: Adjustment[] = [];
    // Classify every settlement observation before deriving its ledger entries. This keeps the
    // exception queue useful when adjustment is invoked directly (for example by the demo API).
    for (const date of new Set(this.store.data.settlements.map(x => x.businessDate))) this.exceptions(date);
    const append = (adjustment: Adjustment) => { if (!this.store.data.adjustments.some(x => x.id === adjustment.id)) { this.store.data.adjustments.push(adjustment); made.push(adjustment); } };
    for (const settlement of this.store.data.settlements) {
      const close = this.store.data.closes.find(x => x.date === settlement.businessDate); const order = this.orderFor(settlement.orderRef);
      if (!close || !order || this.settlementWasInClose(settlement, close)) continue;
      const commissionDelta = order.money.commission - settlement.commission;
      // The payout delta left after the commission component is the discount/net evidence. Components are additive by construction.
      const payoutDelta = settlement.settled - order.money.paid;
      const netDelta = commissionDelta + payoutDelta;
      const appendComponent = (component: Adjustment['component'], amount: number, reason: Reason) => {
        if (amount === 0) return;
        append({ id: id('adjustment', close.id, `${settlement.id}_${component}`), closeId: close.id, settlementId: settlement.id, orderId: order.id, amount, reason, component, createdAt: now() });
      };
      appendComponent('commission', commissionDelta, 'COMMISSION_MISMATCH');
      appendComponent('discount', payoutDelta, settlement.platformDiscount !== order.money.platformDiscount ? 'DISCOUNT_MISMATCH' : 'SETTLEMENT_VARIANCE');
      if (netDelta !== 0) this.recordException({ date: settlement.businessDate, reason: 'SETTLEMENT_VARIANCE', orderId: order.id, settlementId: settlement.id, sourceIds: [order.id, settlement.id, close.id], detail: `Linked additive adjustments total ${netDelta}; settlement net=${settlement.settled - settlement.commission}, close net=${order.money.paid - order.money.commission}.` });
    }
    this.store.save(); return made;
  }
  list() { return this.store.data; }
}

export const order = (source: string, externalId: string, channel: Channel, date: string, customer: string, minute: string, money: Money, status: 'paid' | 'cancelled' = 'paid', canonicalRef?: string): Omit<Order, 'id' | 'ingestedAt'> => ({ source, externalId, channel, businessDate: date, occurredAt: `${date}T${minute}:00.000Z`, customer, status, money, canonicalRef });
