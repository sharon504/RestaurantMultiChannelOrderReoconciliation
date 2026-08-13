export type Exception = { id: string; order: string; channel: string; reason: string; amount: number; severity: "critical" | "review" | "info" };
export type Adjustment = { id: string; settlement: string; reason: string; amount: number; status: "pending" | "posted" };
export type OrderTrace = { id: string; occurredAt: string; channel: string; externalId: string; merchantRef?: string; decision: "canonical" | "merged" | "review"; canonicalOrder: string; explanation: string };
export type DashboardData = {
  businessDate: string;
  close: { id: string; status: "closed" | "open"; closedAt: string; revenue: number; orderCount: number };
  metrics: { label: string; value: string; detail: string; tone?: "accent" | "alert" }[];
  exceptions: Exception[];
  adjustments: Adjustment[];
  orderTraces: OrderTrace[];
};
