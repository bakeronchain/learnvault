# Backend request tracing

LearnVault backend now emits a per-request correlation ID for every inbound HTTP
request.

## What is emitted

- Each request gets a generated UUID in request middleware.
- The value is returned to clients as `X-Request-ID`.
- All `console.*` logs produced in request scope are prefixed with
  `[requestId=<uuid>]`.
- Stellar transaction calls include a best-effort short memo
  (`rid:<24-char-id>`) to propagate trace context downstream.

## Trace a request end-to-end

1. Make a request and capture the `X-Request-ID` response header.
2. Search backend logs for that exact request ID.
3. Find associated Stellar call logs and transaction hashes in the same log
   window.
4. On-chain memo values prefixed with `rid:` can be matched back to request IDs.

## Operational notes

- Request tracing is automatic; no route-level changes are required.
- Worker/background logs do not include a request ID unless one is explicitly
  provided.
