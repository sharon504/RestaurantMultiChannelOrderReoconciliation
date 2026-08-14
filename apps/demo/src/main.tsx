import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { loadDashboard, runSimulation, type SimulationAction } from "./api";
import type { DashboardData, Exception } from "./types";
import "./tokens.css";
import "./styles.css";

const money = (minor: number) => `${minor < 0 ? "−" : ""}₹${Math.abs(minor).toLocaleString("en-IN")}`;

function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [source, setSource] = useState<"demo" | "fallback" | "api">("demo");
  const [loadMessage, setLoadMessage] = useState<string>();
  const [simulationMessage, setSimulationMessage] = useState<string>();
  const [runningAction, setRunningAction] = useState<SimulationAction>();
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const { data, source: loadedFrom, message } = await loadDashboard();
    setDashboard(data); setSource(loadedFrom); setLoadMessage(message);
  };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setDialogOpen(true); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (dialogOpen) setTimeout(() => searchRef.current?.focus(), 0); }, [dialogOpen]);

  const results = useMemo(() => {
    if (!dashboard) return [] as Exception[];
    const needle = query.toLowerCase();
    return dashboard.exceptions.filter((item) => [item.id, item.order, item.reason, item.channel].some((value) => value.toLowerCase().includes(needle)));
  }, [dashboard, query]);
  if (!dashboard) return <main className="loading" aria-live="polite">Loading daily close…</main>;

  const simulate = async (action: SimulationAction) => {
    setRunningAction(action); setSimulationMessage(undefined);
    try {
      await runSimulation(action);
      await refresh();
      setSimulationMessage(action === "reset" ? "Baseline restored. Start a new simulation." : action === "close" ? "Daily close captured. It is now immutable." : "T+2 settlement evidence applied as linked adjustments.");
    } catch (error) {
      setSimulationMessage(error instanceof Error ? error.message : "Simulation could not be completed.");
    } finally { setRunningAction(undefined); }
  };
  const canSimulate = source === "api";

  return <>
    <header className="nav"><a className="brand" href="#overview">Ledgerline<span> / close</span></a><nav><a href="#exceptions">Exceptions</a><a href="#adjustments">Adjustments</a></nav><button className="search-pill" onClick={() => setDialogOpen(true)} aria-label="Search exceptions"><span>Find an exception</span><kbd>⌘ K</kbd></button></header>
    <main id="overview" className="shell">
      <section className="hero reveal"><div><p className="eyebrow">Daily close / {dashboard.businessDate}</p><h1>One close. Every channel accounted for.</h1><p className="lede">Review the evidence behind today’s revenue figure, then investigate only the records that do not agree.</p></div><div className="close-panel"><div className="panel-top"><span>close snapshot</span><span className={`status ${dashboard.close.status === "closed" ? "status-closed" : "review"}`}>{dashboard.close.status === "closed" ? "immutable" : "open"}</span></div><strong>{money(dashboard.close.revenue)}</strong><div className="close-meta"><span>{dashboard.close.orderCount} orders</span><span>{dashboard.close.closedAt}</span></div><code>close_id: {dashboard.close.id}</code></div></section>
      <section className="metrics" aria-label="Daily metrics">{dashboard.metrics.map((metric) => <article key={metric.label} className={`metric ${metric.tone ?? ""}`}><p>{metric.label}</p><strong>{metric.value}</strong><small>{metric.detail}</small></article>)}</section>
      <section className="simulator reveal" aria-labelledby="simulator-title">
        <div className="simulator-heading"><div><p className="eyebrow">Scenario lab</p><h2 id="simulator-title">Run the close, then introduce late evidence.</h2><p>Each action uses the reconciliation API. Reset restores the original fixture so you can repeat the sequence.</p></div><span className={`status ${canSimulate ? "status-closed" : "review"}`}>{canSimulate ? "live sandbox" : "API unavailable"}</span></div>
        <div className="scenario-grid">
          <article><span className="scenario-number">01</span><h3>Baseline disagreements</h3><p>Inspect cooked-unpaid, paid-uncooked, cancelled-after-cooking, and ambiguous duplicate evidence.</p><button className="secondary-action" onClick={() => void simulate("reset")} disabled={!canSimulate || !!runningAction}>{runningAction === "reset" ? "Restoring…" : "Reset baseline"}</button></article>
          <article><span className="scenario-number">02</span><h3>Close the business day</h3><p>Freeze the revenue and exception snapshot. Repeating this action is idempotent.</p><button className="primary-action" onClick={() => void simulate("close")} disabled={!canSimulate || !!runningAction || dashboard.close.status === "closed"}>{runningAction === "close" ? "Closing…" : dashboard.close.status === "closed" ? "Day closed" : "Close day"}</button></article>
          <article><span className="scenario-number">03</span><h3>Apply T+2 settlement</h3><p>Append commission and discount differences without rewriting the close.</p><button className="primary-action" onClick={() => void simulate("adjust")} disabled={!canSimulate || !!runningAction || dashboard.close.status !== "closed" || dashboard.adjustments.length > 0}>{runningAction === "adjust" ? "Applying…" : dashboard.adjustments.length > 0 ? "Settlement applied" : "Apply settlement"}</button></article>
        </div>
        <p className="simulation-message" aria-live="polite">{simulationMessage ?? (canSimulate ? "Suggested path: reset → close day → apply settlement." : "Start the reconciliation API to enable simulation controls.")}</p>
      </section>
      <section id="order-trace" className="order-trace reveal" aria-labelledby="trace-title">
        <div className="section-heading"><div><p className="eyebrow">Multi-channel intake</p><h2 id="trace-title">Every source arrives. Only evidence decides a merge.</h2></div><span>{dashboard.orderTraces.length} source records</span></div>
        <p className="trace-lede">The first four records are simultaneous channel intake. A shared merchant reference can link a replay to its canonical order; similar-looking records without one remain separate and enter review.</p>
        <div className="trace-list">{dashboard.orderTraces.map((trace) => <article key={trace.id} className={`trace-row trace-${trace.decision}`}><time>{trace.occurredAt}</time><div><strong>{channelLabel(trace.channel)} · {trace.externalId}</strong><small>{trace.merchantRef ? `merchant ref: ${trace.merchantRef}` : "no shared merchant reference"}</small></div><span className={`status ${trace.decision === "merged" ? "status-closed" : trace.decision === "review" ? "review" : "info"}`}>{trace.decision === "merged" ? "linked" : trace.decision}</span><div className="trace-decision"><code>{trace.canonicalOrder}</code><p>{trace.explanation}</p></div></article>)}</div>
      </section>
      <section id="exceptions" className="workbench reveal"><div className="section-heading"><div><p className="eyebrow">Review queue</p><h2>Exceptions are evidence, not edits.</h2></div><span>{dashboard.exceptions.length} open</span></div><div className="table-wrap"><table><thead><tr><th>Order</th><th>Source</th><th>Reason code</th><th>Exposure</th><th>State</th></tr></thead><tbody>{dashboard.exceptions.map((item) => <ExceptionRow key={item.id} item={item} />)}</tbody></table></div></section>
      <section id="adjustments" className="adjustment-band reveal"><div><p className="eyebrow">T+2 settlement</p><h2>Late evidence becomes an adjustment.</h2><p>Settlement files can change the forward-looking position, but never the closed snapshot. Each difference remains linked to its settlement, order, and original close.</p></div><div className="adjustments">{dashboard.adjustments.map((item) => <article key={item.id}><div><code>{item.id}</code><span className={`status ${item.status}`}>{item.status}</span></div><strong>{money(item.amount)}</strong><p>{item.reason}</p><small>{item.settlement}</small></article>)}</div></section>
      <section className="invariant reveal"><p className="eyebrow">Audit invariant</p><h2>Closed means immutable.</h2><p>The revenue snapshot above is append-only. Reprocessing a feed is idempotent; a contradictory settlement creates a linked adjustment instead of rewriting history.</p><div className="chain"><span>settlement</span><b>→</b><span>canonical order</span><b>→</b><span>adjustment</span><b>→</b><span>original close</span></div></section>
    </main>
    <footer>Demo UI · reconciliation simulation sandbox · data source: {source === "api" ? "configured API" : source === "fallback" ? `local fixture (API fallback${loadMessage ? `: ${loadMessage}` : ""})` : "local fixture"}</footer>
    <dialog open={dialogOpen} onClose={() => setDialogOpen(false)}><form method="dialog" className="command"><header><label htmlFor="exception-search">Search exceptions</label><button aria-label="Close search">Esc</button></header><input ref={searchRef} id="exception-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Order ID, source, or reason code" /><div className="command-results">{results.map((item) => <button key={item.id} onClick={() => setDialogOpen(false)}><span><strong>{item.order}</strong><small>{item.reason}</small></span><em>{money(item.amount)}</em></button>)}{results.length === 0 && <p>No matching exception in this close.</p>}</div></form></dialog>
  </>;
}

function ExceptionRow({ item }: { item: Exception }) { return <tr><td data-label="Order"><strong>{item.order}</strong><small>{item.id}</small></td><td data-label="Source">{item.channel}</td><td data-label="Reason"><code>{item.reason}</code></td><td data-label="Exposure">{money(item.amount)}</td><td data-label="State"><span className={`status ${item.severity}`}>{item.severity}</span></td></tr>; }
function channelLabel(channel: string) { return ({ pos: "POS", app: "Own app", agg1: "Aggregator 1", agg2: "Aggregator 2" } as Record<string, string>)[channel] ?? channel; }
createRoot(document.getElementById("root")!).render(<App />);
