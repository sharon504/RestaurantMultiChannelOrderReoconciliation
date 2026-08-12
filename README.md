# Restaurant Multi-Channel Order Reconciliation

Reconciliation service for a restaurant group taking orders through four channels: **in-store POS, its own app, Aggregator 1, and Aggregator 2**. It reconciles a day's orders against the kitchen confirmation log, closes the day with an immutable revenue figure, and re-reconciles when T+2 settlement files arrive. It generates its own synthetic feeds, deliberately injecting disagreements, and validates output against known ground truth.

**Core design:** *close-then-adjust*. A closed day never mutates; a contradicting settlement file surfaces as a traceable adjustment.

**Implementation stack:** Node.js (TypeScript) backend, React frontend.

## Reconciliation cases

- Cooked but unpaid
- Paid but uncooked
- Cancelled but already cooked
- Commission / platform-discount mismatches (gross-only comparison will not balance)
- Feed duplicates vs. genuine repeat orders (ambiguous cases surface, never silently merged)
- Settlement timing differences and other unmatched/inconsistent records

## Key assumptions

- **Business day** — determined by order timestamp in the configured restaurant timezone.
- **Order identity** — a canonical order is created at ingestion; source IDs are retained for traceability.
- **Matching** — deterministic policy. Strong IDs give confident matches; otherwise-similar records are treated as ambiguous rather than merged.
- **Duplicates** — never auto-deleted; the relationship is recorded and ambiguity becomes an exception.
- **Finance** — reconciliation compares gross, discounts, commission, and paid/settled amounts, not gross alone.
- **Cancellations** — stay in history; if already cooked, they become a meaningful exception.
- **Daily close** — immutable snapshot of the day as known at close time.
- **Late settlement** — a later observation of a closed day; contradictions become adjustments, never rewrites.
- **Ground truth** — the generator records the intended state of every injected discrepancy so output can be evaluated objectively.

## Setup

```bash
git clone <repository-url>
cd restaurant-order-reconciliation
pnpm install
cp .env.example .env   # configure local DB/app settings
```

## Run

```bash
pnpm run generate                 # 1. generate synthetic feeds + ground truth
pnpm run ingest:orders            # 2. normalize the four order feeds
pnpm run ingest:kitchen           # 3. ingest kitchen confirmations
pnpm run reconcile -- --date YYYY-MM-DD   # 4. daily reconciliation + financial summary
pnpm run close -- --date YYYY-MM-DD       # 5. close the day (becomes immutable)
pnpm run ingest:settlement -- <settlement-file>  # 6. ingest T+2 settlement
pnpm run adjust                   # 7. create adjustments against the closed day
pnpm run validate                 # 8. compare output against ground truth
```

Generated data lands in `data/` (order feeds, kitchen confirmations, settlements, ground truth). Output includes daily-close figures, an exception report, and adjustment records linked to the original close.

## Scope limits (intentionally excluded)

| Excluded | Why |
| --- | --- |
| Real restaurant integrations (POS/aggregators/payments) | Brief requires the system to generate its own feeds; no third-party credentials. |
| Payment processing | This is a reconciliation system, not a payment processor. |
| ERP/accounting posting | Adjustments are generated and traceable but not auto-posted externally. |
| Customer ordering UI | Orders are inputs to reconciliation only. |
| Inventory management | Unrelated to the reconciliation problem. |
| Delivery/logistics tracking | Aggregator orders are financial/order records only. |
| Advanced fraud detection | Scope is deterministic reconciliation discrepancies. |
| ML-based matching | Structured inputs allow an explicit deterministic policy, easier to validate. |
| Real-time streaming | The brief centers on daily reconciliation and T+2 processing. |

## Validation

Reconciliation output is compared against the generated ground truth across: order matching, duplicate handling, unpaid/uncooked/cancel-after-cook detection, commission/discount/timing discrepancies, daily totals, adjustment amounts, traceability, and immutable-close behavior.
