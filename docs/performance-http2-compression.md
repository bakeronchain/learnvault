# HTTP/2 and Compression — Issue #744

## Compression middleware

`compression` (gzip/brotli) is applied immediately after `express()` in
`server/src/index.ts`.

A custom filter skips already-compressed content to avoid wasted CPU:

- `image/*`, `video/*`, `audio/*`
- `application/octet-stream`
- Any URL path containing `/ipfs/` (IPFS gateway passthrough)

All other responses (JSON, HTML, text) are compressed at level 6.

## HTTP/2

HTTP/2 is **not terminated at the Node layer**. Express does not natively
support HTTP/2.

In all deployed environments, HTTP/2 is handled by the reverse proxy in front of
Node:

- Local dev: HTTP/1.1 is fine
- Production: configure HTTP/2 at the proxy level (Nginx, Caddy, AWS ALB,
  Cloudflare, etc.)

No code change is required in the Express app.

## Cache-Control for static assets

The Express backend does not serve static assets — all static files are served
by the frontend build (Vite). Cache-Control headers for static assets should be
configured at the CDN or frontend hosting layer, not here.

## Latency

Compression reduces response payload size for JSON API responses. Typical
improvement for JSON-heavy endpoints (course lists, leaderboard, milestones) is
60–80% reduction in transfer size. Actual latency improvement depends on network
conditions and client bandwidth.
