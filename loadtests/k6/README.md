# k6 load tests

## Smoke (`smoke.js`)

Light baseline against staging or local:

```bash
BASE_URL=http://localhost:4000 k6 run loadtests/k6/smoke.js
```

Optional auth check:

```bash
BASE_URL=http://localhost:4000 K6_JWT=<jwt> k6 run loadtests/k6/smoke.js
```

## Pool concurrency (`pool-concurrency.js`)

Validates the shared PostgreSQL pool under **50 concurrent virtual users**
without connection exhaustion. Requires a running API with `DATABASE_URL`
configured.

```bash
BASE_URL=http://localhost:4000 k6 run loadtests/k6/pool-concurrency.js
```

The test asserts `/api/health` reports `dbPool.waitingClients` ≤
`K6_MAX_POOL_WAITING` (default `5`).
