export type Channel = "pos" | "app" | "agg1" | "agg2";
export type Status = "paid" | "cancelled";
export type Reason =
  | "COOKED_UNPAID"
  | "PAID_UNCOOKED"
  | "CANCELLED_AFTER_COOKING"
  | "COMMISSION_MISMATCH"
  | "DISCOUNT_MISMATCH"
  | "AMBIGUOUS_DUPLICATE"
  | "SETTLEMENT_TIMING"
  | "SETTLEMENT_VARIANCE"
  | "UNMATCHED_SETTLEMENT"
  | "UNMATCHED_KITCHEN"
  | "SOURCE_RECORD_CONFLICT";

export interface Money {
  gross: number;
  platformDiscount: number;
  commission: number;
  paid: number;
}
export interface Order {
  id: string;
  source: string;
  externalId: string;
  channel: Channel;
  businessDate: string;
  occurredAt: string;
  customer: string;
  status: Status;
  money: Money;
  ingestedAt: string;
  /** A merchant-issued ID is a strong cross-feed match. It is never inferred. */
  canonicalRef?: string;
}
export interface Kitchen {
  id: string;
  source: string;
  externalId: string;
  orderRef: string;
  cookedAt: string;
  ingestedAt: string;
}
export interface Settlement {
  id: string;
  source: string;
  externalId: string;
  orderRef: string;
  businessDate: string;
  settled: number;
  commission: number;
  platformDiscount: number;
  receivedAt: string;
}
export interface SourceRecord {
  id: string;
  kind: "order" | "kitchen" | "settlement";
  source: string;
  externalId: string;
  payload: string;
  ingestedAt: string;
  sequence: number;
}
export interface Exception {
  id: string;
  date: string;
  reason: Reason;
  orderId?: string;
  kitchenId?: string;
  settlementId?: string;
  sourceIds: string[];
  detail: string;
  createdAt: string;
  /** Resolution is appended to the exception record; the original evidence stays intact. */
  resolvedAt?: string;
  resolvedBySourceIds?: string[];
}
export interface Close {
  id: string;
  date: string;
  createdAt: string;
  orderIds: string[];
  revenue: number;
  gross: number;
  platformDiscount: number;
  commission: number;
  paid: number;
  exceptionIds: string[];
  /** Position in the append-only source ledger at the moment of close. */
  sourceRecordSequence: number;
  /** Deep copies are audit evidence, not live references to a mutable exception queue. */
  exceptionSnapshot: Exception[];
}
export interface Adjustment {
  id: string;
  closeId: string;
  settlementId: string;
  orderId: string;
  amount: number;
  reason: Reason;
  createdAt: string;
  component: "commission" | "discount" | "net";
}
export interface StoreData {
  orders: Order[];
  kitchens: Kitchen[];
  settlements: Settlement[];
  sourceRecords: SourceRecord[];
  exceptions: Exception[];
  closes: Close[];
  adjustments: Adjustment[];
}
export const emptyStore = (): StoreData => ({
  orders: [],
  kitchens: [],
  settlements: [],
  sourceRecords: [],
  exceptions: [],
  closes: [],
  adjustments: [],
});
export const id = (kind: string, source: string, external: string) =>
  `${kind}_${source}_${external}`.replace(/[^a-zA-Z0-9_:-]/g, "_");
