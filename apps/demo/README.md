# Demo frontend

Read-only Vite/React demo for the restaurant reconciliation service. It is intentionally isolated in `apps/demo` so the backend can define the root workspace independently.

## Run

```bash
cd apps/demo
pnpm install
pnpm dev
```

The UI starts with representative fixture data. To connect a backend, set `VITE_API_BASE` to an API base URL. The demo requests:

```text
GET {VITE_API_BASE}/dashboard?date=2026-08-12
```

The endpoint should return the `DashboardData` shape in `src/types.ts`. If the API is unavailable, the UI safely falls back to demo data so presentations remain usable.

`pnpm build` performs the TypeScript check and production bundle build.
