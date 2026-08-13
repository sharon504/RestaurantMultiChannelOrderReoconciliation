type Channel = "pos" | "app" | "agg1" | "agg2";
type Reason = "COOKED_UNPAID" | "PAID_UNCOOKED" | "CANCELLED_AFTER_COOKING" | "AMBIGUOUS_DUPLICATE" | "COMMISSION_MISMATCH" | "DISCOUNT_MISMATCH" | "UNMATCHED_SETTLEMENT" | "SETTLEMENT_TIMING";

type Order = {
  id: string;
  externalId: string;
  channel: Channel;
  status: "paid" | "cancelled";
  money: { gross: number; platformDiscount: number; commission: number; paid: number };
};
type Exception = { id: string; date: string; reason: Reason; orderId?: string; settlementId?: string };
type Close = { id: string; date: string; createdAt: string; orderIds: string[]; revenue: number; gross: number; platformDiscount: number; commission: number; paid: number; exceptionIds: string[]; exceptionSnapshot: Exception[] };
type Adjustment = { id: string; closeId: string; settlementId: string; orderId: string; amount: number; reason: "COMMISSION_MISMATCH" | "DISCOUNT_MISMATCH"; component: "commission" | "discount"; createdAt: string };
type State = { orders: Order[]; settlements: { id: string; externalId: string }[]; closes: Close[]; adjustments: Adjustment[]; adjusted: boolean };

const date = "2026-08-10";
const now = () => new Date().toISOString();
const json = (body: unknown, status = 200): Response => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const initialState = (): State => ({
  orders: [
    ["pos", "P-100", "pos", "paid", 1200, 0, 0, 1200],
    ["app", "A-200", "app", "paid", 1500, 100, 0, 1400],
    ["agg1", "G1-300", "agg1", "paid", 2000, 200, 300, 1500],
    ["agg2", "G2-400", "agg2", "paid", 1800, 0, 270, 1530],
    ["app", "A-500", "app", "paid", 900, 0, 0, 0],
    ["pos", "P-600", "pos", "paid", 800, 0, 0, 800],
    ["agg1", "G1-700", "agg1", "cancelled", 1000, 0, 150, 850],
    ["app", "A-801", "app", "paid", 500, 0, 0, 500],
    ["app", "A-802", "app", "paid", 500, 0, 0, 500]
  ].map(([source, externalId, channel, status, gross, platformDiscount, commission, paid]) => ({
    id: `order_${source}_${externalId}`,
    externalId: externalId as string,
    channel: channel as Channel,
    status: status as "paid" | "cancelled",
    money: { gross: gross as number, platformDiscount: platformDiscount as number, commission: commission as number, paid: paid as number }
  })),
  settlements: [
    { id: "settlement_agg1_S-300", externalId: "S-300" },
    { id: "settlement_agg2_S-400", externalId: "S-400" },
    { id: "settlement_agg1_S-UNKNOWN", externalId: "S-UNKNOWN" }
  ],
  closes: [],
  adjustments: [],
  adjusted: false
});

const baseExceptions = (): Exception[] => [
  ["COOKED_UNPAID", "order_app_A-500"],
  ["PAID_UNCOOKED", "order_pos_P-600"],
  ["CANCELLED_AFTER_COOKING", "order_agg1_G1-700"],
  ["AMBIGUOUS_DUPLICATE", "order_app_A-801"],
  ["AMBIGUOUS_DUPLICATE", "order_app_A-802"]
].map(([reason, orderId], index) => ({ id: `exception_${reason}_${index + 1}`, date, reason: reason as Reason, orderId }));

const settlementExceptions = (): Exception[] => [
  ["COMMISSION_MISMATCH", "order_agg1_G1-300", "settlement_agg1_S-300"],
  ["DISCOUNT_MISMATCH", "order_agg2_G2-400", "settlement_agg2_S-400"],
  ["UNMATCHED_SETTLEMENT", undefined, "settlement_agg1_S-UNKNOWN"],
  ["SETTLEMENT_TIMING", undefined, "settlement_agg1_S-UNKNOWN"]
].map(([reason, orderId, settlementId], index) => ({
  id: `exception_${reason}_${index + 6}`,
  date,
  reason: reason as Reason,
  ...(orderId ? { orderId } : {}),
  ...(settlementId ? { settlementId } : {})
}));

const report = (state: State) => {
  const exceptions = [...baseExceptions(), ...(state.adjusted ? settlementExceptions() : [])];
  return { date, orders: state.orders.length, gross: 10200, platformDiscount: 300, commission: 720, paid: 8280, revenue: 7560, exceptions };
};

async function loadState(db: D1Database): Promise<State> {
  const stored = await db.prepare("SELECT body FROM app_state WHERE id = 1").first<{ body: string }>();
  if (stored) return JSON.parse(stored.body) as State;
  const state = initialState();
  await db.prepare("INSERT OR IGNORE INTO app_state (id, body, updated_at) VALUES (1, ?, ?)").bind(JSON.stringify(state), now()).run();
  const created = await db.prepare("SELECT body FROM app_state WHERE id = 1").first<{ body: string }>();
  if (!created) throw new Error("Unable to initialize application state");
  return JSON.parse(created.body) as State;
}

async function saveState(db: D1Database, state: State): Promise<void> {
  await db.prepare("UPDATE app_state SET body = ?, updated_at = ? WHERE id = 1").bind(JSON.stringify(state), now()).run();
}

function close(state: State): Close {
  const existing = state.closes.find((item) => item.date === date);
  if (existing) return existing;
  const reconciliation = report(state);
  const created: Close = {
    id: "close_day_2026-08-10", date, createdAt: now(), orderIds: state.orders.map((order) => order.id),
    revenue: reconciliation.revenue, gross: reconciliation.gross, platformDiscount: reconciliation.platformDiscount,
    commission: reconciliation.commission, paid: reconciliation.paid,
    exceptionIds: reconciliation.exceptions.map((exception) => exception.id), exceptionSnapshot: reconciliation.exceptions
  };
  state.closes.push(created);
  return created;
}

function adjust(state: State): Adjustment[] {
  if (state.adjusted) return [];
  const existingClose = state.closes.find((item) => item.date === date);
  if (!existingClose) return [];
  const createdAt = now();
  const made: Adjustment[] = [
    { id: "adjustment_close_day_2026-08-10_settlement_agg1_S-300_commission", closeId: existingClose.id, settlementId: "settlement_agg1_S-300", orderId: "order_agg1_G1-300", amount: 50, reason: "COMMISSION_MISMATCH", component: "commission", createdAt },
    { id: "adjustment_close_day_2026-08-10_settlement_agg2_S-400_discount", closeId: existingClose.id, settlementId: "settlement_agg2_S-400", orderId: "order_agg2_G2-400", amount: -50, reason: "DISCOUNT_MISMATCH", component: "discount", createdAt }
  ];
  state.adjustments.push(...made);
  state.adjusted = true;
  return made;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") return json({ ok: true });
    if (!url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);

    try {
      const state = await loadState(env.DB);
      if (request.method === "GET" && url.pathname === "/api/state") return json({ ...state, exceptions: report(state).exceptions });
      if (request.method === "GET" && url.pathname === "/api/reconciliation") {
        const requestedDate = url.searchParams.get("date") ?? date;
        return requestedDate === date ? json(report(state)) : json({ error: `No seeded data for ${requestedDate}` }, 404);
      }
      if (request.method === "GET" && url.pathname === "/api/exceptions") return json(report(state).exceptions);
      if (request.method === "GET" && url.pathname === "/api/closes") return json(state.closes);
      if (request.method === "GET" && url.pathname === "/api/adjustments") return json(state.adjustments);
      if (request.method === "POST" && url.pathname === "/api/close") {
        const result = close(state); await saveState(env.DB, state); return json(result);
      }
      if (request.method === "POST" && url.pathname === "/api/adjust") {
        const result = adjust(state); await saveState(env.DB, state); return json(result);
      }
      if (request.method === "POST" && url.pathname === "/api/reset") {
        const reset = initialState(); await saveState(env.DB, reset); return json({ ok: true, state: reset });
      }
      return json({ error: "not found" }, 404);
    } catch (error) {
      console.error(JSON.stringify({ event: "api_error", message: error instanceof Error ? error.message : "unknown" }));
      return json({ error: "internal server error" }, 500);
    }
  }
} satisfies ExportedHandler<Env>;
