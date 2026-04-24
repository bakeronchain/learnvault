# CSRF Protection

## TL;DR

The LearnVault API is **bearer-token only** — JWTs travel in the `Authorization`
header and never in a cookie — which eliminates classical cookie-riding CSRF on
its own. On top of that, a dedicated `requireTrustedOrigin` middleware rejects
state-changing requests (`POST`/`PUT`/`PATCH`/`DELETE`) whose `Origin` or
`Referer` header does not match the configured allowlist. Together these give
browser-mediated CSRF no path through the API surface. This document explains
both layers and the invariants that keep them true.

## Threat model

CSRF (Cross-Site Request Forgery) is the attack where a victim, already
authenticated to `api.learnvault.app`, visits `evil.example` in the same
browser. JavaScript on `evil.example` triggers a state-changing request to the
API, and the browser silently attaches the victim's ambient credentials.

Two things are required for this attack to succeed:

1. The victim's browser must **auto-attach credentials** to the cross-origin
   request (cookies, HTTP basic auth, or a client TLS cert).
2. The API must **accept** the request on the basis of those credentials.

Remove either leg and CSRF cannot occur.

## Why the LearnVault API is not vulnerable

### The API does not authenticate via cookies

Authentication is exclusively a JWT delivered in the `Authorization: Bearer`
header. The token is issued by `POST /api/auth/verify` (wallet signature
challenge flow) and stored by the frontend in `localStorage`, not in a cookie.

Audit evidence:

- No cookie-parser or session middleware is installed
  (`grep -R "cookie-parser\|express-session" server/` is empty).
- No route calls `res.cookie(...)` or reads `req.cookies`
  (`grep -R "req\.cookies\|res\.cookie" server/src` is empty).
- The auth middleware (`server/src/middleware/auth.middleware.ts`) only reads
  the `Authorization` header.

Because the server never sets an auth cookie, browsers have nothing to
auto-attach on cross-origin requests — the "ambient credential" leg of the
attack is absent.

### Custom headers trigger a CORS preflight

The `Authorization` header is not one of the
[CORS-safelisted request headers](https://fetch.spec.whatwg.org/#cors-safelisted-request-header).
Any cross-origin request that includes it is a "non-simple" request, and the
browser issues a preflight `OPTIONS` before the real request. If the preflight
response does not include an `Access-Control-Allow-Origin` matching the
attacker's origin, the browser refuses to send the real request at all.

Attacker-controlled code in the browser **cannot read the victim's token out of
`localStorage` on a different origin** (Same-Origin Policy), so even if an
attacker crafted a form that bypassed preflight, they have no way to populate
the `Authorization` header with the victim's JWT.

### CORS is a strict allowlist

`server/src/index.ts` configures `cors` with a validator function that rejects
any origin not in the allowlist (production: `learnvault.app` and
`www.learnvault.app`; development: local dev ports). Rejected origins produce no
`Access-Control-Allow-Origin` header, and the cors middleware forwards the
rejection to the error handler so the route never runs.

### `requireTrustedOrigin` middleware (explicit CSRF gate)

`server/src/middleware/csrf.middleware.ts` exports
`createRequireTrustedOrigin(allowedOrigins)`. Mounted globally after `cors` and
before the route handlers, it applies only to state-changing methods
(`POST`/`PUT`/`PATCH`/`DELETE`) and enforces:

- If `Origin` is present, it must be in the allowlist. Otherwise → `403`.
- If `Origin` is absent but `Referer` is present, the parsed origin of the
  `Referer` must be in the allowlist. Otherwise → `403`.
- If both are absent, the request passes. This preserves server-to-server
  clients (curl, Postman, internal workers) which have no browser fingerprint to
  validate. Bearer auth is the load-bearing defense for that path; the gate is
  defense-in-depth layered on top.

Why a dedicated middleware on top of CORS:

- The cors middleware only inspects `Origin`. `requireTrustedOrigin` also
  validates `Referer` when `Origin` is missing, which covers edge cases (some
  redirect chains, older clients) where a browser might omit `Origin`.
- CORS rejections surface as generic errors via the error handler. The dedicated
  gate returns a specific `403 Forbidden: untrusted origin`, which is easier to
  diagnose and audit.
- Pinning the check in a named middleware means a regression shows up as a
  changed middleware chain, not a subtle CORS option flip.

These are all defense-in-depth layers. CORS and `Origin`/`Referer` validation
are enforced by the browser/client; a non-browser attacker can forge any header
they want. **Do not rely on either as an authentication boundary** —
per-endpoint authentication is what protects unauthorized clients.

## Invariants that must be preserved

The "CSRF is not applicable" claim holds only while every item below is true. If
any change violates one of these, this document and the corresponding test
(`server/src/tests/csrf.test.ts`) must be revisited.

1. **No auth cookies.** The server must not call `res.cookie(...)` for any
   session, JWT, or auth-equivalent value. Non-auth cookies (e.g. a preference
   flag with no privilege attached) are acceptable but discouraged since they
   muddy the invariant.
2. **No cookie-parser / session middleware.** `cookie-parser`,
   `express-session`, `passport`-with-sessions, or similar must not be
   installed.
3. **Bearer header is the only authenticator.** Any new authentication
   middleware must read credentials from headers (or a signed request body),
   never from `req.cookies` or an ambient client-cert.
4. **CORS stays an allowlist.** The `cors` middleware in `server/src/index.ts`
   must not be broadened to `origin: true` or `origin: "*"`.
5. **Never reflect arbitrary `Origin`.** Do not echo `req.headers.origin` into
   `Access-Control-Allow-Origin` without checking it against the allowlist.
6. **`requireTrustedOrigin` stays wired in.** It must be mounted globally in
   `server/src/index.ts` before the route handlers, and the allowlist passed to
   it must match the cors allowlist. Removing it or narrowing its method set
   must be paired with an equivalent replacement.

## What would change this

Introducing cookie-based authentication (e.g. a refresh-token cookie, an SSR
session, or a shared-cookie architecture with a sibling subdomain) changes the
threat model. At that point this API becomes CSRF-exploitable and we must add,
at minimum:

- `SameSite=Strict` (or `Lax` with explicit justification) on every auth cookie.
- `Secure` and `HttpOnly` on every auth cookie.
- A CSRF token (double-submit cookie or synchronizer pattern) validated on every
  state-changing endpoint.
- Tests proving the token is required.

Do not introduce cookie auth without also landing those defenses in the same PR.

## Related authorization gaps (not CSRF)

The audit that produced this document flagged several state-changing endpoints
that currently require no authentication at all — for example
`POST /api/governance/proposals`, `POST /api/governance/vote`,
`POST /api/scholarships/apply`, `POST /api/milestones/submit`.

These are **not** CSRF vulnerabilities — they have no auth to forge — but they
are authorization gaps. They should be tracked and fixed separately under a
"require auth for state-changing endpoints" task. This document addresses the
CSRF question only.

## Test coverage

`server/src/tests/csrf.test.ts` enforces the invariants above:

- A preflight from a disallowed origin does not grant
  `Access-Control-Allow-Origin`.
- A POST from a disallowed origin is blocked at the CORS layer.
- A POST without `Authorization` is rejected with 401.
- A POST with an invalid Bearer token is rejected with 401.
- A successful POST on a protected endpoint sets no `Set-Cookie` header.
- A POST to an unauthenticated endpoint is rejected with 403 when `Origin` is
  untrusted (`requireTrustedOrigin`).
- A POST is rejected with 403 when only `Referer` is set and it is untrusted or
  malformed.
- A POST succeeds when only `Referer` is set and it is trusted.
- A POST with neither `Origin` nor `Referer` passes the gate (permissive
  server-to-server posture).
- GETs are not gated by `requireTrustedOrigin`.

## References

- [OWASP: CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [`docs/cors-configuration.md`](./cors-configuration.md) — CORS allowlist
  configuration, which is the defense-in-depth layer described above.
