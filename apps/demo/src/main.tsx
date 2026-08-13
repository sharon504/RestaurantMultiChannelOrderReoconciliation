import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { loadDashboard } from "./api";
import type { DashboardData, Exception } from "./types";
import "./tokens.css";
import "./styles.css";

const money = (minor: number) => `${minor < 0 ? "−" : ""}₹${Math.abs(minor).toLocaleString("en-IN")}`;

function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [source, setSource] = useState<"demo" | "fallback" | "api">("demo");
  const [loadMessage, setLoadMessage] = useState<string>();
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadDashboard().then(({ data, source: loadedFrom, message }) => { setDashboard(data); setSource(loadedFrom); setLoadMessage(message); }); }, []);
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

  return <>
    <header className="nav"><a className="brand" href="#overview">Ledgerline<span> / close</span></a><nav><a href="#exceptions">Exceptions</a><a href="#adjustments">Adjustments</a></nav><button className="search-pill" onClick={() => setDialogOpen(true)} aria-label="Search exceptions"><span>Find an exception</span><kbd>⌘ K</kbd></button></header>
    <main id="overview" className="shell">
      <section className="hero reveal"><div><p className="eyebrow">Daily close / {dashboard.businessDate}</p><h1>One close. Every channel accounted for.</h1><p className="lede">Review the evidence behind today’s revenue figure, then investigate only the records that do not agree.</p></div><div className="close-panel"><div className="panel-top"><span>close snapshot</span><span className={`status ${dashboard.close.status === "closed" ? "status-closed" : "review"}`}>{dashboard.close.status === "closed" ? "immutable" : "open"}</span></div><strong>{money(dashboard.close.revenue)}</strong><div className="close-meta"><span>{dashboard.close.orderCount} orders</span><span>{dashboard.close.closedAt}</span></div><code>close_id: {dashboard.close.id}</code></div></section>
      <section className="metrics" aria-label="Daily metrics">{dashboard.metrics.map((metric) => <article key={metric.label} className={`metric ${metric.tone ?? ""}`}><p>{metric.label}</p><strong>{metric.value}</strong><small>{metric.detail}</small></article>)}</section>
      <section id="exceptions" className="workbench reveal"><div className="section-heading"><div><p className="eyebrow">Review queue</p><h2>Exceptions are evidence, not edits.</h2></div><span>{dashboard.exceptions.length} open</span></div><div className="table-wrap"><table><thead><tr><th>Order</th><th>Source</th><th>Reason code</th><th>Exposure</th><th>State</th></tr></thead><tbody>{dashboard.exceptions.map((item) => <ExceptionRow key={item.id} item={item} />)}</tbody></table></div></section>
      <section id="adjustments" className="adjustment-band reveal"><div><p className="eyebrow">T+2 settlement</p><h2>Late evidence becomes an adjustment.</h2><p>Settlement files can change the forward-looking position, but never the closed snapshot. Each difference remains linked to its settlement, order, and original close.</p></div><div className="adjustments">{dashboard.adjustments.map((item) => <article key={item.id}><div><code>{item.id}</code><span className={`status ${item.status}`}>{item.status}</span></div><strong>{money(item.amount)}</strong><p>{item.reason}</p><small>{item.settlement}</small></article>)}</div></section>
      <section className="invariant reveal"><p className="eyebrow">Audit invariant</p><h2>Closed means immutable.</h2><p>The revenue snapshot above is append-only. Reprocessing a feed is idempotent; a contradictory settlement creates a linked adjustment instead of rewriting history.</p><div className="chain"><span>settlement</span><b>→</b><span>canonical order</span><b>→</b><span>adjustment</span><b>→</b><span>original close</span></div></section>
    </main>
    <footer>Demo UI · Read-only by design · data source: {source === "api" ? "configured API" : source === "fallback" ? `local fixture (API fallback${loadMessage ? `: ${loadMessage}` : ""})` : "local fixture"}</footer>
    <dialog open={dialogOpen} onClose={() => setDialogOpen(false)}><form method="dialog" className="command"><header><label htmlFor="exception-search">Search exceptions</label><button aria-label="Close search">Esc</button></header><input ref={searchRef} id="exception-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Order ID, source, or reason code" /><div className="command-results">{results.map((item) => <button key={item.id} onClick={() => setDialogOpen(false)}><span><strong>{item.order}</strong><small>{item.reason}</small></span><em>{money(item.amount)}</em></button>)}{results.length === 0 && <p>No matching exception in this close.</p>}</div></form></dialog>
  </>;
}

function ExceptionRow({ item }: { item: Exception }) { return <tr><td data-label="Order"><strong>{item.order}</strong><small>{item.id}</small></td><td data-label="Source">{item.channel}</td><td data-label="Reason"><code>{item.reason}</code></td><td data-label="Exposure">{money(item.amount)}</td><td data-label="State"><span className={`status ${item.severity}`}>{item.severity}</span></td></tr>; }
createRoot(document.getElementById("root")!).render(<App />);
