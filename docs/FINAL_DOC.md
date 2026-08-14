# Restaurant Multi-Channel Order Reconciliation

**Repository:** `RestaurantMultiChannelOrderReoconciliation`

**Live Demo:** https://restaurant-reconciliation.sharonpshajan.workers.dev

**Documentation source:** Generated from analysis of the repository source code.

---

# Demo

## Application Overview

Restaurant operations often receive orders from multiple independent systems:

- In-store POS
- Restaurant application
- Third-party aggregators

The purpose of this project is not simply to merge orders.

Instead, the system implements a financially auditable reconciliation workflow that preserves evidence while identifying operational and accounting discrepancies.

The reconciliation engine processes four independent data streams:

```text
Orders
   ↓

Kitchen Events
   ↓

Settlement Records
   ↓

Duplicate Detection
   ↓

Exception Detection
   ↓

Daily Financial Close
   ↓

Late Settlement Adjustments
```

---

## Supported Channels

| Channel | Description |
| --- | --- |
| `pos` | In-store point-of-sale |
| `app` | Restaurant-owned application |
| `agg1` | Aggregator 1 |
| `agg2` | Aggregator 2 |

---

## Implemented Business Rules

### 1. Idempotent Ingestion

Submitting the same order twice does not create duplicate financial records.

```text
P-100
↓

Accepted

P-100 (replayed)
↓

Ignored
```

---

### 2. Merchant References Drive Duplicate Resolution

If two records share the same merchant reference, they are merged into a canonical order.

```text
POS order
Merchant reference = merchant-1

↓

APP order
Merchant reference = merchant-1

↓

Single canonical transaction
```

---

### 3. Similar Records Are Never Automatically Merged

Two records that merely share a customer, timestamp, or order amount are not automatically treated as duplicates.

Instead, they are flagged as:

```text
AMBIGUOUS_DUPLICATE
```

and preserved for manual review.

---

### 4. Daily Financial Closes Are Immutable

```text
Open day
↓

Close generated
↓

Snapshot frozen
```

Late settlements do not modify historical records.

Instead, linked adjustments are created.

---

## Exception Types

| Exception | Meaning |
| --- | --- |
| `COOKED_UNPAID` | Food prepared but not paid |
| `PAID_UNCOOKED` | Payment received but preparation missing |
| `CANCELLED_AFTER_COOKING` | Order cancelled after preparation |
| `AMBIGUOUS_DUPLICATE` | Possible duplicate requiring review |
| `COMMISSION_MISMATCH` | Settlement commission discrepancy |
| `DISCOUNT_MISMATCH` | Settlement discount discrepancy |
| `UNMATCHED_SETTLEMENT` | Settlement without a matching order |
| `SETTLEMENT_TIMING` | Settlement arrived outside the expected window |
| `UNMATCHED_KITCHEN` | Kitchen activity without a corresponding order |
| `SOURCE_RECORD_CONFLICT` | Conflicting duplicate submissions |

---

# API / Interface Definitions

The application exposes eight interfaces.

---

## 1. Get Current State

### Request

```http
GET /api/state
```

### Response

```json
{
  "orders": [],
  "settlements": [],
  "orderTraces": []
}
```

---

### Order Schema

```json
{
  "id": "order_app_A-200",
  "externalId": "A-200",
  "channel": "app",
  "status": "paid",
  "money": {
    "gross": 1500,
    "platformDiscount": 100,
    "commission": 0,
    "paid": 1400
  }
}
```

---

## 2. Get Reconciliation Report

### Request

```http
GET /api/reconciliation?date=2026-08-10
```

### Response

```json
{
  "date": "2026-08-10",
  "orders": 9,
  "gross": 10200,
  "platformDiscount": 300,
  "commission": 720,
  "paid": 8280,
  "revenue": 7560,
  "exceptions": []
}
```

---

## 3. Retrieve Daily Close Records

### Request

```http
GET /api/closes
```

### Response

```json
[
  {
    "id": "close_day_2026-08-10",
    "date": "2026-08-10",
    "createdAt": "2026-08-14T07:00:00Z",
    "revenue": 7560,
    "orderIds": []
  }
]
```

---

## 4. Retrieve Settlement Adjustments

### Request

```http
GET /api/adjustments
```

### Response

```json
[
  {
    "id": "adjustment_1",
    "closeId": "close_day_2026-08-10",
    "settlementId": "settlement_agg1_S-300",
    "orderId": "order_agg1_G1-300",
    "reason": "COMMISSION_MISMATCH",
    "amount": 50
  }
]
```

---

## 5. Generate a Daily Close

### Request

```http
POST /api/close
```

### Response

```json
{
  "id": "close_day_2026-08-10",
  "date": "2026-08-10",
  "revenue": 7560
}
```

---

## 6. Generate Settlement Adjustments

### Request

```http
POST /api/adjust
```

### Response

```json
[
  {
    "reason": "COMMISSION_MISMATCH",
    "amount": 50
  },
  {
    "reason": "DISCOUNT_MISMATCH",
    "amount": -50
  }
]
```

---

## 7. Reset the Simulation

### Request

```http
POST /api/reset
```

### Response

```json
{
  "success": true
}
```

---

## 8. Order Trace Interface

Order traces are returned through `/api/state`.

```json
{
  "id": "trace_pos_P-100",
  "occurredAt": "09:00",
  "channel": "pos",
  "externalId": "P-100",
  "merchantRef": "R-100",
  "decision": "canonical",
  "canonicalOrder": "order_pos_P-100",
  "explanation": "POS is the first authoritative record."
}
```

---

# Test Plan & Implementation

The automated test suite is implemented in:

```text
src/test/reconciliation.test.ts
```

---

## Testing Strategy

```text
Unit Testing
↓

Business Rule Testing
↓

Workflow Testing
↓

Financial Audit Testing
```

---

## Implemented Tests

### Immutable Daily Closes

**Objective**

Verify that a financial close cannot be modified after creation.

```text
Close generated
↓

Settlement arrives later
↓

Adjustment appended

↓

Original close unchanged
```

**Verified behavior**

- Immutable close snapshots
- Adjustment generation
- Exception preservation

---

### Idempotent Ingestion

**Objective**

Verify duplicate submissions.

**Assertions**

- First submission accepted
- Second submission ignored
- Original record preserved
- Conflicts recorded

---

### Duplicate Matching Rules

**Objective**

Verify duplicate detection.

```text
Shared merchant reference
↓

Merge

Similar customer + amount
↓

Review only
```

**Assertions**

- Merchant references create canonical orders
- Similar orders generate `AMBIGUOUS_DUPLICATE` exceptions

---

### Settlement Before Financial Close

**Assertions**

- Mismatches appear in the close snapshot
- No adjustment is created

---

### Source Conflict Preservation

**Assertions**

- Conflicts remain visible in immutable snapshots

---

### Unmatched Kitchen and Settlement Evidence

**Assertions**

The following exceptions are detected correctly:

- `UNMATCHED_KITCHEN`
- `UNMATCHED_SETTLEMENT`
- `SETTLEMENT_TIMING`

---

## Coverage Summary

| Feature | Tested |
| --- | --- |
| Idempotency | ✓ |
| Duplicate detection | ✓ |
| Settlement reconciliation | ✓ |
| Financial close generation | ✓ |
| Adjustment generation | ✓ |
| Snapshot immutability | ✓ |
| Exception preservation | ✓ |
| Kitchen reconciliation | ✓ |

---

# Future Improvements

## Database Normalization

### Current implementation

```text
Local JSON store (or a Render persistent disk)
↓

Single JSON application state
```

### Future implementation

```text
orders
settlements
kitchen_events
closes
adjustments
exceptions
```

using normalized relational tables.

---

## Multi-Day Reconciliation

### Current limitation

The implementation is effectively tied to a single business date.

### Improvement

Support:

- Arbitrary dates
- Historical reconciliation
- Multi-day reporting

---

## Authentication & Authorization

### Current limitation

API endpoints are exposed without authentication.

### Improvement

Introduce:

- JWT authentication
- Role-based access control
- Audit permissions

---

## Real-Time Event Processing

### Current implementation

```text
Manual API trigger
↓

Reconciliation
```

### Improvement

```text
Event streams
↓

Message queues
↓

Automatic reconciliation
```

using Cloudflare Queues, RabbitMQ, or Kafka.

---

## Expanded Test Coverage

Additional testing should include:

- API integration tests
- Worker tests
- UI tests
- Load testing
- End-to-end browser automation

---

## Highest-Priority Enhancements

1. Multi-day reconciliation
2. Normalized persistence
3. Authentication
4. End-to-end testing
5. Event-driven processing
6. Production monitoring

---

# Conclusion

The project demonstrates a financially auditable restaurant reconciliation engine rather than a simple order-merging system.

Its most important architectural characteristics are:

- Idempotent ingestion
- Evidence-based duplicate detection
- Immutable financial closes
- Append-only settlement adjustments
- Exception traceability
- Audit-oriented reconciliation

These architectural decisions make the system substantially more reliable than traditional deduplication-based reconciliation approaches.
