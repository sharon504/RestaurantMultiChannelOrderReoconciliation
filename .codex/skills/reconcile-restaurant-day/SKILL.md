---
name: reconcile-restaurant-day
description: Reconcile restaurant order feeds, kitchen confirmations, daily closes, and late aggregator settlements using an auditable close-then-adjust workflow. Use when building, reviewing, testing, or operating multi-channel restaurant order reconciliation, duplicate-handling policy, exception queues, immutable closes, or settlement adjustments.
---

# Reconcile a restaurant day

Implement the reconciliation as a deterministic, append-only workflow. Retain raw source identity and normalized financial components in minor units.

## Workflow

1. Generate four channel feeds, kitchen events, late settlement files, and an independent truth manifest. Include unpaid, uncooked, cancelled-after-cook, duplicate/ambiguous, commission/discount, and timing cases.
2. Normalize each source record without discarding source IDs. Ingest idempotently using `(source, externalId)`; preserve conflicting replays as source-conflict evidence and make settlement ingestion/adjustment creation replay-safe too.
3. Match on a strong shared identifier only. For a weak customer/time/amount resemblance, persist an ambiguous relationship and emit an exception; never merge it.
4. Reconcile using `grossMinor`, `discountMinor`, `commissionMinor`, `paidMinor`, and kitchen state. Do not balance only on gross.
5. Close by inserting a complete snapshot and summary. Expose no update path for its figures.
6. When a settlement for a closed day contradicts its known finance, append an adjustment linked to the settlement record, order, and original close. Compute reporting totals as close plus adjustments.
7. Validate reason codes, totals, links, idempotency, and unchanged close snapshot against the generated truth manifest.

## Required invariants

- Money is integer minor units; dates and source timestamps are explicit.
- A cancellation remains in history and becomes `CANCELLED_AFTER_COOKING` if confirmed by the kitchen.
- Potential source duplicates and plausible repeat customer orders are distinguishable only by policy state (`ambiguous`), never silent deduplication.
- Adjustments are additive ledger entries. They never mutate a close or its exceptions.
- Use the canonical reason-code set in [reason-codes.md](references/reason-codes.md); add new codes there before emitting them.

Read [reason-codes.md](references/reason-codes.md) when selecting or reviewing classifications.
