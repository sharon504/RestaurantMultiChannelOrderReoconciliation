# Reconciliation reason codes

Use stable, actionable codes:

- `COOKED_UNPAID`: kitchen confirmation exists but the normalized order has no paid amount.
- `PAID_UNCOOKED`: a paid, non-cancelled order has no kitchen confirmation by close.
- `CANCELLED_AFTER_COOKING`: cancellation arrived after kitchen confirmation.
- `COMMISSION_MISMATCH`: settlement commission differs from expected commission.
- `DISCOUNT_MISMATCH`: settlement platform discount differs from the order feed.
- `SETTLEMENT_TIMING`: settlement has not arrived or is for a different processing day.
- `AMBIGUOUS_DUPLICATE`: records are similar but lack a strong ID; preserve both for review.
- `UNMATCHED_SETTLEMENT`: settlement record cannot be confidently attached to an order.
- `UNMATCHED_KITCHEN`: kitchen confirmation has no strong order reference.
- `SOURCE_RECORD_CONFLICT`: a replay reused a source identity with a different payload; the accepted record remains unchanged.
- `SETTLEMENT_VARIANCE`: linked late-settlement components change the forward-looking net position.

For a late contradiction, create an adjustment with a signed `amountMinor`, the original close ID, settlement record ID, canonical order ID when matched, and a reason code.
