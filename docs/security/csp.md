# Content Security Policy (CSP)

## Overview

LearnVault serves its HTTP responses through an Express backend that uses
[Helmet](https://helmetjs.github.io/) to set security headers. The
`Content-Security-Policy` header is the primary defence against cross-site
scripting (XSS) and unwanted resource injection.

This document records the rationale behind every directive, the specific origins
that were added for Freighter wallet support, and the operational rollout
strategy for staging vs. production.

---

## Current Policy

```
default-src 'self';
script-src  'self' 'unsafe-inline' https://cdn.jsdelivr.net https://browser.sentry-cdn.com;
connect-src 'self'
            https://horizon-testnet.stellar.org
            https://horizon.stellar.org
            https://soroban-testnet.stellar.org
            https://rpc-mainnet.stellar.org
            https://*.stellar.org
            https://ipfs.io
            https://gateway.pinata.cloud
            https://*.mypinata.cloud
            https://*.ingest.sentry.io
            https://fonts.googleapis.com;
img-src     'self' data: https://ipfs.io https://gateway.pinata.cloud https://*.mypinata.cloud;
style-src   'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src    'self' https://fonts.gstatic.com;
frame-ancestors 'none';
upgrade-insecure-requests;
```

Configuration lives in `server/src/index.ts` (the Helmet middleware call).

---

## Directive Rationale

### `default-src 'self'`

Fallback for any directive not explicitly listed. Everything must come from the
same origin unless overridden below.

### `script-src`

| Source                           | Reason                                                                                                                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'self'`                         | Application's own bundled scripts (Vite build output).                                                                                                                                                                                                  |
| `'unsafe-inline'`                | Required for the FOUC-prevention inline `<script>` in `index.html` that applies the saved colour-scheme before first paint. A nonce-based approach is the preferred long-term fix once SSR or a build-time nonce injection is in place.                 |
| `https://cdn.jsdelivr.net`       | Swagger UI assets served in non-production environments (`/api/docs/ui`).                                                                                                                                                                               |
| `https://browser.sentry-cdn.com` | Sentry CDN bundle, used when the Sentry SDK is loaded from CDN rather than bundled. The npm-bundled `@sentry/react` path does not technically require this, but it is listed defensively so the policy does not block Sentry's own error-replay loader. |

**Freighter note:** The Freighter browser extension injects its API
(`window.freighterApi`) via a _content script_ executed in the extension's own
isolated world — not as a `<script>` tag from the page's origin. Content scripts
are exempt from the page's CSP and therefore require **no `script-src`
allowance**. Adding `chrome-extension:` to `script-src` would be unnecessary and
would widen the attack surface.

### `connect-src`

Controls `fetch()`, `XMLHttpRequest`, `WebSocket`, and `EventSource`
destinations.

| Origin                                | Reason                                                                                                                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'self'`                              | Calls to our own `/api/*` backend.                                                                                                                                                                             |
| `https://horizon-testnet.stellar.org` | Stellar Horizon (testnet) — account balances, transaction submission.                                                                                                                                          |
| `https://horizon.stellar.org`         | Stellar Horizon (mainnet).                                                                                                                                                                                     |
| `https://soroban-testnet.stellar.org` | Soroban RPC (testnet) — smart contract calls via `@stellar/stellar-sdk`.                                                                                                                                       |
| `https://rpc-mainnet.stellar.org`     | Soroban RPC (mainnet public endpoint).                                                                                                                                                                         |
| `https://*.stellar.org`               | Catch-all for any additional SDF-operated RPC/Horizon hosts the SDK discovers (e.g. `friendbot.stellar.org`).                                                                                                  |
| `https://ipfs.io`                     | IPFS content fetched for NFT metadata and course materials.                                                                                                                                                    |
| `https://gateway.pinata.cloud`        | Pinata IPFS gateway for uploaded assets.                                                                                                                                                                       |
| `https://*.mypinata.cloud`            | Dedicated Pinata gateways (configurable via `IPFS_GATEWAY_URL`).                                                                                                                                               |
| `https://*.ingest.sentry.io`          | Sentry event ingestion endpoint. The exact subdomain matches the project DSN (e.g. `o123456.ingest.sentry.io`). The wildcard covers all account IDs so the header does not need updating when the DSN changes. |
| `https://fonts.googleapis.com`        | Google Fonts CSS metadata endpoint (some browsers make a `fetch()` request for it).                                                                                                                            |

**Freighter / Soroban RPC:** The Freighter extension mediates contract
interactions by relaying signed XDR to the Soroban RPC URL configured by the
user's network settings. In most cases this is one of the `*.stellar.org`
origins already listed. Custom RPC endpoints (e.g. `production.network.rpc-url`
from `environments.toml`) should be added to `connect-src` if they differ from
the SDF-operated URLs above.

### `img-src`

Allows images from our own origin, `data:` URIs (inline avatars, SVG), and IPFS
gateways (NFT images, badge thumbnails).

### `style-src`

`'unsafe-inline'` is required for Tailwind CSS, the Stellar Design System, and
component-level style attributes. Google Fonts stylesheet
(`fonts.googleapis.com`) must also be listed.

### `font-src`

Google Fonts binary font files are served from `fonts.gstatic.com`.

### `frame-ancestors 'none'`

Prevents the app from being embedded in an `<iframe>` on any other origin,
mitigating clickjacking attacks. Use `frame-ancestors 'self'` if preview embeds
are needed in the future.

### `upgrade-insecure-requests`

Instructs browsers to upgrade HTTP sub-resource requests to HTTPS automatically.

---

## Freighter Wallet Compatibility

Freighter is a Chrome/Firefox extension that:

1. Injects `window.freighterApi` into the page via an **isolated content
   script**. Content scripts run in the extension context, not the page's
   browsing context, so they are completely unaffected by the page's CSP.
2. Communicates with the background service worker via `chrome.runtime` — again,
   extension-internal and invisible to the page CSP.
3. The host page calls `window.freighterApi.*()` methods. These are synchronous
   object accesses and do not trigger any CSP checks.
4. When the SDK submits a signed transaction, it calls `fetch()` against the
   Soroban RPC or Horizon endpoint. Those origins must be in `connect-src` (see
   table above).

No `chrome-extension:` or `moz-extension:` source expression is needed in any
directive.

---

## Sentry Reporting Integration

Sentry's `@sentry/react` SDK sends error events to
`https://o<id>.ingest.sentry.io` via `fetch()`.

### `connect-src`

`https://*.ingest.sentry.io` covers all Sentry project DSN ingest hosts.

### `report-uri` (CSP violation reports to Sentry)

Sentry can also receive CSP violation reports directly, giving you a centralised
view of policy violations alongside application errors.

To enable, add your Sentry CSP report URL to the `reportUri` directive:

```typescript
// server/src/index.ts — inside contentSecurityPolicy.directives
reportUri: [`https://o<YOUR_ORG_ID>.ingest.sentry.io/api/<PROJECT_ID>/security/?sentry_key=<KEY>`],
```

Replace the placeholders with values from **Sentry → Project Settings → Security
Headers**.

---

## Staging Rollout: Report-Only Mode

To safely validate the policy before enforcing it in production the server
supports a **Report-Only** mode. In this mode the browser observes the CSP but
does not block anything — violations are only logged.

### How it works

The Helmet `contentSecurityPolicy.reportOnly` option is set to `true` when
either of the following is true:

- `NODE_ENV=staging`
- `CSP_REPORT_ONLY=true` (in the environment)

This causes Helmet to emit `Content-Security-Policy-Report-Only` instead of
`Content-Security-Policy`.

### Recommended rollout sequence

1. Deploy with `CSP_REPORT_ONLY=true` (or `NODE_ENV=staging`) in staging.
2. Monitor the browser console and Sentry for CSP violation reports over a
   representative traffic window (at least 48 hours).
3. For each violation: decide whether to tighten the policy or add the source to
   an allowlist, then update `server/src/index.ts` accordingly.
4. Once no new violations appear, promote the enforcing policy to production by
   removing the `CSP_REPORT_ONLY` env var (or setting it to `false`).

---

## Testing

An automated Playwright test suite (`e2e/csp-freighter.spec.ts`) verifies that:

- The app loads without any CSP violations logged to the browser console.
- The mock Freighter wallet connects successfully (wallet address visible in
  NavBar) — this exercises the same CSP code-path a real extension uses.
- Key pages (`/`, `/profile`, `/courses`, `/dao/proposals`) are free of CSP
  errors.

Run the suite with:

```bash
npx playwright test e2e/csp-freighter.spec.ts
```

---

## Files Modified / Created

| File                        | Change                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/index.ts`       | Expanded Helmet CSP directives: added Soroban RPC, Pinata, Sentry ingest, Google Fonts, `fontSrc`, `styleSrc`, `frameAncestors`. Added Report-Only staging gate. |
| `server/.env.example`       | Documented `CSP_REPORT_ONLY` environment variable.                                                                                                               |
| `e2e/csp-freighter.spec.ts` | New Playwright test — CSP violation detection with mock Freighter.                                                                                               |
| `docs/security/csp.md`      | This document.                                                                                                                                                   |

---

## References

- [Helmet CSP documentation](https://helmetjs.github.io/)
- [MDN: Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)
- [Freighter GitHub repository](https://github.com/stellar/freighter)
- [Sentry — Security Policy Reporting](https://docs.sentry.io/platforms/javascript/security-policy-reporting/)
- [Stellar Horizon endpoints](https://developers.stellar.org/network/horizon)
- [Soroban RPC endpoints](https://developers.stellar.org/network/soroban-rpc)
