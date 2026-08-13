import { demoData } from "./demo-data";
import type { Adjustment, DashboardData, Exception } from "./types";

// Empty means same-origin: Vite proxies /api to the local backend during development,
// while a production deployment can serve the UI and API from the same origin.
const apiBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") ?? "";
const businessDate = import.meta.env.VITE_BUSINESS_DATE ?? "2026-08-10";

type ApiOrder = {
  id: string;
  externalId: string;
  channel: "pos" | "app" | "agg1" | "agg2";
  money: { gross: number; platformDiscount: number; commission: number; paid: number };
};
type ApiException = { id: string; orderId?: string; settlementId?: string; reason: string };
type ApiReconciliation = {
  date: string; orders: number; gross: number; platformDiscount: number; commission: number; paid: number; revenue: number; exceptions: ApiException[];
};
type ApiClose = { id: string; date: string; createdAt: string; revenue: number; orderIds: string[] };
type ApiAdjustment = { id: string; closeId: string; orderId: string; settlementId: string; reason: string; amount: number };
type ApiState = { orders: ApiOrder[]; settlements: { id: string; externalId: string }[] };

export type DashboardLoad = { data: DashboardData; source: "demo" | "fallback" | "api"; message?: string };

const channelName: Record<ApiOrder["channel"], string> = {
  pos: "In-store POS", app: "Own app", agg1: "Aggregator 1", agg2: "Aggregator 2"
};

const formatMoney = (amount: number) => `${amount < 0 ? "−" : ""}₹${Math.abs(amount).toLocaleString("en-IN")}`;
const formatTime = (value: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
const severityFor = (reason: string): Exception["severity"] =>
  ["COOKED_UNPAID", "CANCELLED_AFTER_COOKING", "SETTLEMENT_VARIANCE"].includes(reason) ? "critical" :
    reason === "AMBIGUOUS_DUPLICATE" ? "review" : "info";

function exposureFor(exception: ApiException, order: ApiOrder | undefined, adjustments: ApiAdjustment[]): number {
  if (!order) return 0;
  if (exception.reason === "SETTLEMENT_VARIANCE") return adjustments.find((item) => item.orderId === order.id)?.amount ?? 0;
  if (exception.reason === "COMMISSION_MISMATCH") return order.money.commission;
  if (exception.reason === "DISCOUNT_MISMATCH") return order.money.platformDiscount;
  if (exception.reason === "COOKED_UNPAID" || exception.reason === "CANCELLED_AFTER_COOKING") return order.money.gross;
  if (exception.reason === "PAID_UNCOOKED") return order.money.paid;
  return 0;
}

function toDashboard(reconciliation: ApiReconciliation, closes: ApiClose[], adjustments: ApiAdjustment[], state: ApiState): DashboardData {
  const orders = new Map(state.orders.map((order) => [order.id, order]));
  const settlements = new Map(state.settlements.map((settlement) => [settlement.id, settlement.externalId]));
  const close = closes.find((item) => item.date === reconciliation.date);
  const exceptions = reconciliation.exceptions.map((item): Exception => {
    const order = item.orderId ? orders.get(item.orderId) : undefined;
    return { id: item.id, order: order?.externalId ?? item.orderId ?? "Unlinked", channel: order ? channelName[order.channel] : "Unknown", reason: item.reason, amount: exposureFor(item, order, adjustments), severity: severityFor(item.reason) };
  });
  const displayedAdjustments: Adjustment[] = adjustments
    .filter((item) => !close || item.closeId === close.id)
    .map((item) => ({ id: item.id, settlement: settlements.get(item.settlementId) ?? item.settlementId, reason: item.reason, amount: item.amount, status: "posted" }));
  const exposure = exceptions.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const affectedOrders = new Set(exceptions.map((item) => item.order).filter((order) => order !== "Unlinked"));
  const matched = Math.max(0, reconciliation.orders - affectedOrders.size);
  return {
    businessDate: reconciliation.date,
    close: close
      ? { id: close.id, status: "closed", closedAt: formatTime(close.createdAt), revenue: close.revenue, orderCount: close.orderIds.length }
      : { id: "Not closed", status: "open", closedAt: "Awaiting close", revenue: reconciliation.revenue, orderCount: reconciliation.orders },
    metrics: [
      { label: "Recognised revenue", value: formatMoney(reconciliation.revenue), detail: `${reconciliation.orders} canonical orders`, tone: "accent" },
      { label: "Match confidence", value: reconciliation.orders ? `${((matched / reconciliation.orders) * 100).toFixed(1)}%` : "—", detail: `${matched} orders without exceptions` },
      { label: "Exception exposure", value: formatMoney(exposure), detail: `${exceptions.length} records need review`, tone: "alert" },
      { label: "T+2 settlement delta", value: formatMoney(displayedAdjustments.reduce((sum, item) => sum + item.amount, 0)), detail: `${displayedAdjustments.length} linked adjustments` }
    ],
    exceptions,
    adjustments: displayedAdjustments
  };
}

export async function loadDashboard(): Promise<DashboardLoad> {
  try {
    const get = async <T>(path: string): Promise<T> => {
      const response = await fetch(`${apiBase}${path}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`${path} request failed (${response.status})`);
      return response.json() as Promise<T>;
    };
    const query = `?date=${encodeURIComponent(businessDate)}`;
    const [reconciliation, closes, adjustments, state] = await Promise.all([
      get<ApiReconciliation>(`/api/reconciliation${query}`), get<ApiClose[]>("/api/closes"), get<ApiAdjustment[]>("/api/adjustments"), get<ApiState>("/api/state")
    ]);
    return { data: toDashboard(reconciliation, closes, adjustments, state), source: "api" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach the configured API";
    return { data: demoData, source: "fallback", message };
  }
}

export type SimulationAction = "close" | "adjust" | "reset";

export async function runSimulation(action: SimulationAction): Promise<void> {
  const response = await fetch(`${apiBase}/api/${action}`, { method: "POST", headers: { Accept: "application/json" } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `${action} simulation failed (${response.status})`);
  }
}
