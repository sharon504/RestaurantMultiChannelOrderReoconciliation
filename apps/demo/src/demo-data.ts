import type { DashboardData } from "./types";

export const demoData: DashboardData = {
  businessDate: "2026-08-12",
  close: { id: "close_01J6V2M4", status: "closed", closedAt: "13 Aug, 02:14 IST", revenue: 184_762, orderCount: 438 },
  metrics: [
    { label: "Recognised revenue", value: "₹1,84,762", detail: "438 canonical orders", tone: "accent" },
    { label: "Match confidence", value: "96.4%", detail: "422 strong ID matches" },
    { label: "Exception exposure", value: "₹6,318", detail: "7 records need review", tone: "alert" },
    { label: "T+2 settlement delta", value: "+₹840", detail: "3 traceable adjustments" }
  ],
  exceptions: [
    { id: "ex_001", order: "AG1-88421", channel: "Aggregator 1", reason: "COMMISSION_MISMATCH", amount: 482, severity: "critical" },
    { id: "ex_002", order: "POS-10282", channel: "In-store POS", reason: "PAID_UNCOOKED", amount: 1_260, severity: "review" },
    { id: "ex_003", order: "APP-44019", channel: "Own app", reason: "CANCELLED_AFTER_COOKING", amount: 1_890, severity: "critical" },
    { id: "ex_004", order: "AG2-73290", channel: "Aggregator 2", reason: "AMBIGUOUS_DUPLICATE", amount: 0, severity: "review" }
  ],
  adjustments: [
    { id: "adj_009", settlement: "agg1_tplus2_2026-08-14.csv", reason: "SETTLEMENT_TIMING", amount: 840, status: "pending" },
    { id: "adj_008", settlement: "agg2_tplus2_2026-08-14.csv", reason: "PLATFORM_DISCOUNT", amount: -216, status: "posted" },
    { id: "adj_007", settlement: "agg1_tplus2_2026-08-14.csv", reason: "COMMISSION_VARIANCE", amount: 192, status: "posted" }
  ],
  orderTraces: []
};
