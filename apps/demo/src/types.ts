export type Exception = { id: string; order: string; channel: string; reason: string; amount: number; severity: "critical" | "review" | "info" };
export type Adjustment = { id: string; settlement: string; reason: string; amount: number; status: "pending" | "posted" };
export type DashboardData = {
  businessDate: string;
  close: { id: string; status: "closed"; closedAt: string; revenue: number; orderCount: number };
  metrics: { label: string; value: string; detail: string; tone?: "accent" | "alert" }[];
  exceptions: Exception[];
  adjustments: Adjustment[];
};
