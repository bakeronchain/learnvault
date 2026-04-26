# k6 load tests

- Install [k6](https://k6.io/docs/getting-started/installation/).
- Set the base URL and (for auth) a JWT:  
  `BASE_URL=https://staging.example.com K6_JWT=eyJ... k6 run loadtests/k6/smoke.js`
- **Targets:** keep p95 latency for these smoke paths under **500 ms** at baseline load. Alert if weekly runs regress beyond ~20% from a saved baseline in CI.

Scripts:

| File | Exercises |
|------|-----------|
| `smoke.js` | `GET /api/health`, `GET /api/courses` (or courses list route), `POST` milestone path via optional env |

Weekly automation: see `.github/workflows/loadtest-staging.yml` (use repository variables for `K6_STAGING_BASE_URL`).
