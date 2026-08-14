# Postman testing

Import these two files into Postman:

1. `restaurant-reconciliation.postman_collection.json`
2. `restaurant-reconciliation.local.postman_environment.json`

Select the **Restaurant Reconciliation - Render** environment, then run the collection in its listed order. Both the collection and environment default to `https://restaurant-reconciliation.onrender.com`. To test locally, start `pnpm serve` and change `baseUrl` to `http://127.0.0.1:3000`.

The collection tests the API workflow:

| Stage | Check |
| --- | --- |
| `01 - Reset fixture` | Restores the seeded open-day baseline. |
| `02–04` | Health, reconciliation totals, and append-only source evidence. |
| `05–07` | Close creation, idempotency, and stored immutable snapshot. |
| `08–10` | Late settlement adjustments, reason codes, and unchanged original close. |
| `11` | Unknown API routes return `404`. |

`Reset fixture` and later steps mutate the selected service’s demo state. Run the collection serially; do not use Postman’s parallel runner. The free Render tier can take a short time to wake after inactivity—retry the request if Postman reports a transient `404` or network failure.

## Testing ingestion routes

The deployed full backend also accepts append-only JSON-array ingestion requests:

- `POST {{baseUrl}}/api/ingest/orders`
- `POST {{baseUrl}}/api/ingest/kitchen`
- `POST {{baseUrl}}/api/ingest/settlements`

Use the generated files in `data/orders.json`, `data/kitchen.json`, and `data/settlements.json` as request bodies. Replaying an identical source record is an idempotent no-op; conflicting replays are preserved as `SOURCE_RECORD_CONFLICT` evidence.
