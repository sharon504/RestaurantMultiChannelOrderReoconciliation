# Using the Reconciliation Simulator

The Restaurant Reconciliation Simulator demonstrates a daily financial close across four ordering channels: in-store POS, the restaurant app, Aggregator 1, and Aggregator 2.

It is built around one accounting rule:

> A closed day is immutable. Late settlement evidence becomes a linked adjustment instead of changing the original close.

## Hosted simulator

The hosted dashboard is served by Cloudflare Workers Static Assets at <https://restaurant-reconciliation.sharonpshajan.workers.dev>. Its `/api/*` requests are proxied to the Render Node service, which runs the same reconciliation engine as the local CLI and seeds the baseline fixture when its store is empty. Use **Reset baseline** before starting a new demonstration.

## Run a complete scenario

The **Scenario lab** on the dashboard guides the intended sequence.

1. **Reset baseline**

   Restores the seeded fixture. The day is open, there are no posted adjustments, and the original operational discrepancies are visible.

2. **Review baseline disagreements**

   The exception queue includes these simulated conditions:

   - Cooked but unpaid order
   - Paid but uncooked order
   - Cancelled after cooking
   - Ambiguous duplicate orders

   These are evidence for review; the simulator does not silently remove or merge them.

   The **Multi-channel intake** panel also shows every channel arriving in the same timeline. It demonstrates both duplicate decisions:

   - A replay with the shared merchant reference `R-100` is linked to the POS canonical order and is not counted twice.
   - App orders `A-801` and `A-802` look similar, but lack a shared strong reference. They remain two separate orders and are explicitly marked for review.

3. **Close day**

   Captures a daily snapshot including recognised revenue, financial components, canonical orders, and the current exceptions. The operation is idempotent: selecting it again returns the same close instead of creating another one.

4. **Apply settlement**

   Simulates T+2 settlement evidence arriving after the close. It appends linked adjustments for:

   - A commission mismatch of `₹50`
   - A platform-discount mismatch of `−₹50`

   The close itself does not change. The adjustment cards and exception queue show the new settlement evidence.

5. **Reset baseline**

   Restores the original fixture so the sequence can be repeated. This is useful for demos, testing, and workshops.

## What to observe

| Stage | Expected result |
| --- | --- |
| Baseline | Five operational exceptions; the day is still open. |
| Close | An immutable close snapshot is shown with recognised revenue of `₹7,560`. |
| Settlement | Two linked adjustments appear; the close revenue remains unchanged. |
| Reset | Closes and adjustments are cleared and the baseline exceptions return. |

## API usage

The dashboard uses same-origin API endpoints. They can also be exercised directly for integration testing.

```bash
base='https://restaurant-reconciliation.sharonpshajan.workers.dev'

# Inspect current state
curl "$base/api/reconciliation?date=2026-08-10"
curl "$base/api/exceptions"
curl "$base/api/closes"
curl "$base/api/adjustments"

# Run the scenario
curl -X POST "$base/api/reset"
curl -X POST "$base/api/close"
curl -X POST "$base/api/adjust"
```

The endpoints have the following behavior:

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/health` | `GET` | Confirms the service is available. |
| `/api/state` | `GET` | Returns the seeded state, close records, and adjustments. |
| `/api/reconciliation?date=2026-08-10` | `GET` | Returns daily revenue and the current exception report. |
| `/api/exceptions` | `GET` | Returns the current exception queue. |
| `/api/closes` | `GET` | Returns immutable close snapshots. |
| `/api/adjustments` | `GET` | Returns settlement-linked adjustments. |
| `/api/close` | `POST` | Creates the daily close if it does not already exist. |
| `/api/adjust` | `POST` | Posts the settlement adjustments after a close exists. |
| `/api/reset` | `POST` | Restores the original shared demo fixture. |
| `/api/ingest/orders` | `POST` | Idempotently ingests an array of order source records. |
| `/api/ingest/kitchen` | `POST` | Idempotently ingests an array of kitchen source records. |
| `/api/ingest/settlements` | `POST` | Idempotently ingests an array of settlement source records. |

## Local simulation

Install the root and demo dependencies, then start the local Node API and Vite dashboard together:

```bash
pnpm install
pnpm --dir apps/demo install
pnpm dev
```

Open <http://127.0.0.1:5173>. The local Node service starts on <http://127.0.0.1:3000>.

The local workflow seeds deterministic data before it starts. Use the CLI when you want to run the complete lifecycle without the dashboard:

```bash
pnpm demo
pnpm validate
```

## Persistence and deployment

Render runs the Node API. Cloudflare serves the compiled dashboard and forwards `/api/*` to Render through a static-assets Worker configured in `wrangler.jsonc`; it has no D1 binding or backend persistence. The free Render service uses an ephemeral JSON store, which is appropriate for the deterministic demo. Attach a Render persistent disk and set `STORE_PATH` to its mount path for durable state; persistent disks require a paid Render service.

The public deployment is intended as a shared demonstration environment. For a production restaurant workflow, protect mutation routes with authentication and replace the seeded fixture with authenticated ingestion from approved source systems.
