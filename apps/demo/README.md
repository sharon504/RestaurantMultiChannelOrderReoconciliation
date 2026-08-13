# Demo frontend

Read-only Vite/React demo for the restaurant reconciliation service. It is intentionally isolated in `apps/demo` so the backend can define the root workspace independently.

## Run

```bash
cd apps/demo
pnpm install
pnpm dev
```

The UI starts with representative fixture data. To connect the included backend, start it from the repository root with `pnpm demo` followed by `pnpm serve`, then run `pnpm dev` here. Vite proxies same-origin `/api` requests to `http://localhost:3000` in development, so no environment variable or backend CORS configuration is required. In a same-origin deployment, this works unchanged; for a separately hosted API, set `VITE_API_BASE` and configure that API's CORS policy. Optionally set `VITE_BUSINESS_DATE` (defaults to the supplied fixture date, `2026-08-10`). The demo only performs these read-only requests:

```text
GET {VITE_API_BASE}/api/reconciliation?date={VITE_BUSINESS_DATE}
GET {VITE_API_BASE}/api/closes
GET {VITE_API_BASE}/api/adjustments
GET {VITE_API_BASE}/api/state
```

The frontend composes these backend resources into its display model. If the API is unavailable, it visibly falls back to demo data so presentations remain usable.

`pnpm build` performs the TypeScript check and production bundle build.
