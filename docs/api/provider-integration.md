# Provider Integration API

This document is the developer portal reference for the LearnVault third-party
course provider integration API.

External course providers can use this API to:

- Submit and manage courses on the LearnVault platform
- Report learner milestone and course completions
- Read on-chain LRN token balances
- Receive real-time webhook notifications on platform events

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [Rate Limits](#rate-limits)
- [Scopes](#scopes)
- [Endpoints](#endpoints)
  - [Courses](#courses)
  - [Completions](#completions)
  - [LRN Balances](#lrn-balances)
  - [Webhooks](#webhooks)
- [Webhook Events](#webhook-events)
- [Webhook Signature Verification](#webhook-signature-verification)
- [SDK — @learnvault/provider-sdk](#sdk--learnvaultprovider-sdk)
- [Admin — Managing Provider Keys](#admin--managing-provider-keys)
- [Error Reference](#error-reference)

---

## Getting Started

1. **Request an API key** from a LearnVault admin
   (`POST /api/admin/provider-keys`).
2. Include the key as the `X-Provider-API-Key` header on every request.
3. All provider endpoints are under `/api/provider/`.

```bash
curl https://api.learnvault.app/api/provider/courses \
  -H "X-Provider-API-Key: lvpk_your_key_here"
```

---

## Authentication

All provider endpoints require the `X-Provider-API-Key` header. Keys are created
by LearnVault admins and are scoped to specific capabilities.

| Header               | Value                                 |
| -------------------- | ------------------------------------- |
| `X-Provider-API-Key` | Your full provider API key (`lvpk_…`) |

API keys are one-way hashed on storage — the full key is shown only at creation
time. Store it securely; it cannot be recovered.

---

## Rate Limits

Provider traffic uses a **separate rate limiter** from regular user traffic.

| Limit                | Window     | Applies to                           |
| -------------------- | ---------- | ------------------------------------ |
| 300 requests         | 60 seconds | All provider endpoints (blanket)     |
| Configurable per key | 60 seconds | Set when the key is created by admin |

Rate limit state is communicated via standard `X-RateLimit-*` headers on every
response. When the limit is exceeded you receive:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0

{
  "error": "Provider rate limit exceeded. See X-RateLimit-* headers for details.",
  "message": "Provider rate limit exceeded. See X-RateLimit-* headers for details."
}
```

---

## Scopes

Each API key is granted a set of scopes that control which endpoints it can
call.

| Scope               | Grants access to                                                   |
| ------------------- | ------------------------------------------------------------------ |
| `courses:write`     | `POST /api/provider/courses`                                       |
| `completions:write` | `POST /api/provider/completions`                                   |
| `lrn:read`          | `GET /api/provider/lrn-balances/:address`                          |
| `webhooks:write`    | `POST /api/provider/webhooks`, `DELETE /api/provider/webhooks/:id` |

`GET` endpoints (list courses, list completions, list webhooks, list deliveries)
are accessible to any valid key regardless of scope.

---

## Endpoints

### Courses

#### Submit a course

```
POST /api/provider/courses
```

Requires scope: `courses:write`

Submits a new course to the platform. The course is created in draft state
(`is_published: false`) and must be reviewed and published by a LearnVault
admin.

**Request body:**

```json
{
	"title": "Introduction to Soroban",
	"slug": "intro-to-soroban",
	"description": "Learn to build smart contracts on Stellar.",
	"difficulty": "beginner",
	"track": "stellar",
	"external_url": "https://youracademy.com/courses/intro-soroban"
}
```

| Field          | Type                                         | Required | Description                                       |
| -------------- | -------------------------------------------- | -------- | ------------------------------------------------- |
| `title`        | `string`                                     | Yes      | Course title                                      |
| `slug`         | `string`                                     | Yes      | URL-friendly identifier (must be globally unique) |
| `description`  | `string`                                     | No       | Course description                                |
| `difficulty`   | `"beginner" \| "intermediate" \| "advanced"` | Yes      | Difficulty level                                  |
| `track`        | `string`                                     | No       | Learning track (e.g. `"stellar"`, `"defi"`)       |
| `external_url` | `string`                                     | No       | Canonical URL on the provider's platform          |

**Response `201 Created`:**

```json
{
	"data": {
		"id": 42,
		"title": "Introduction to Soroban",
		"slug": "intro-to-soroban",
		"description": "Learn to build smart contracts on Stellar.",
		"difficulty": "beginner",
		"track": "stellar",
		"external_url": "https://youracademy.com/courses/intro-soroban",
		"is_published": false,
		"created_at": "2026-05-30T10:00:00Z"
	}
}
```

---

#### List your courses

```
GET /api/provider/courses?limit=20&offset=0
```

Returns courses submitted by the authenticated provider key.

**Query parameters:**

| Parameter | Default | Max   | Description       |
| --------- | ------- | ----- | ----------------- |
| `limit`   | `20`    | `100` | Number of results |
| `offset`  | `0`     | —     | Pagination offset |

**Response `200 OK`:**

```json
{
  "data": [ ... ],
  "pagination": { "total": 3, "limit": 20, "offset": 0 }
}
```

---

### Completions

#### Report a completion

```
POST /api/provider/completions
```

Requires scope: `completions:write`

Records that a learner has completed a course or milestone. The `course_id` must
belong to the authenticated provider key. Duplicate completions (same learner +
course + milestone) are rejected with `409`.

**Request body:**

```json
{
	"learner_address": "GBWD7LRWSSBZQCQDFLQ5BHBZQFPQRG6VVKZ3DPANRTMHW7XZMN3YDDB",
	"course_id": 42,
	"milestone_id": 7,
	"tx_hash": "abc123def456...",
	"completed_at": "2026-05-30T09:30:00Z"
}
```

| Field             | Type              | Required | Description                                                    |
| ----------------- | ----------------- | -------- | -------------------------------------------------------------- |
| `learner_address` | `string`          | Yes      | Learner's Stellar wallet address                               |
| `course_id`       | `number`          | Yes      | Platform course ID (from course submission)                    |
| `milestone_id`    | `number`          | No       | Specific milestone completed (omit for full course completion) |
| `tx_hash`         | `string`          | No       | On-chain transaction hash if applicable                        |
| `completed_at`    | `ISO 8601 string` | No       | Completion timestamp (defaults to now)                         |

**Response `201 Created`:**

```json
{
	"data": {
		"id": 101,
		"learner_address": "GBWD7...",
		"course_id": 42,
		"milestone_id": 7,
		"tx_hash": "abc123...",
		"completed_at": "2026-05-30T09:30:00Z",
		"created_at": "2026-05-30T10:01:00Z"
	}
}
```

---

#### List completions

```
GET /api/provider/completions?course_id=42&limit=50&offset=0
```

Returns all completions recorded by the authenticated provider key.

**Query parameters:**

| Parameter   | Default | Description                 |
| ----------- | ------- | --------------------------- |
| `course_id` | —       | Filter to a specific course |
| `limit`     | `50`    | Max `200`                   |
| `offset`    | `0`     | Pagination offset           |

---

### LRN Balances

#### Get a learner's LRN balance

```
GET /api/provider/lrn-balances/:address
```

Requires scope: `lrn:read`

Returns the off-chain tracked LRN token balance for a Stellar wallet address,
derived from indexed on-chain mint and transfer events.

**Response `200 OK`:**

```json
{
	"address": "GBWD7LRWSSBZQCQDFLQ5BHBZQFPQRG6VVKZ3DPANRTMHW7XZMN3YDDB",
	"lrn_balance": "1500000000"
}
```

> **Note:** Balances are in the smallest token unit (stroops for Stellar-native
> tokens). Divide by `10_000_000` to get the human-readable LRN amount.

---

### Webhooks

#### Register a webhook

```
POST /api/provider/webhooks
```

Requires scope: `webhooks:write`

Registers a URL to receive HTTP POST notifications when platform events occur.

**Request body:**

```json
{
	"url": "https://youracademy.com/webhooks/learnvault",
	"events": ["milestone.completed", "completion.recorded"]
}
```

| Field    | Type       | Required | Description                                                         |
| -------- | ---------- | -------- | ------------------------------------------------------------------- |
| `url`    | `string`   | Yes      | HTTPS URL to receive events (must be HTTPS)                         |
| `events` | `string[]` | Yes      | Event types to subscribe to (see [Webhook Events](#webhook-events)) |

**Response `201 Created`:**

```json
{
	"data": {
		"id": 5,
		"url": "https://youracademy.com/webhooks/learnvault",
		"events": ["milestone.completed", "completion.recorded"],
		"is_active": true,
		"signing_secret": "whsec_c3RvcmVtZXNlY3VyZWx5...",
		"failure_count": 0,
		"created_at": "2026-05-30T10:00:00Z"
	}
}
```

> **Important:** `signing_secret` is returned **only at creation time** and
> cannot be retrieved again. Store it securely immediately.

---

#### List webhooks

```
GET /api/provider/webhooks
```

Returns all webhooks registered for the authenticated provider key.

---

#### Delete a webhook

```
DELETE /api/provider/webhooks/:id
```

Requires scope: `webhooks:write`. Permanently removes the webhook and all its
delivery records.

---

#### List webhook deliveries

```
GET /api/provider/webhooks/:id/deliveries
```

Returns the last 100 delivery attempts for a webhook — useful for debugging
failed deliveries.

**Response `200 OK`:**

```json
{
	"data": [
		{
			"id": 88,
			"event_type": "milestone.completed",
			"status": "delivered",
			"attempts": 1,
			"response_status": 200,
			"delivered_at": "2026-05-30T10:05:00Z",
			"created_at": "2026-05-30T10:05:00Z"
		}
	]
}
```

---

## Webhook Events

LearnVault dispatches events as HTTP `POST` requests to your registered URL with
`Content-Type: application/json`.

### `milestone.completed`

Fired when a learner completes a milestone on any course on the platform.

```json
{
	"event": "milestone.completed",
	"occurred_at": "2026-05-30T10:05:00Z",
	"data": {
		"learner_address": "GBWD7...",
		"course_id": 42,
		"course_slug": "intro-to-soroban",
		"milestone_id": 7,
		"tx_hash": "abc123..."
	}
}
```

### `course.enrolled`

Fired when a learner enrolls in a course submitted by your provider key.

```json
{
	"event": "course.enrolled",
	"occurred_at": "2026-05-30T10:04:00Z",
	"data": {
		"learner_address": "GBWD7...",
		"course_id": 42,
		"course_slug": "intro-to-soroban",
		"tx_hash": "def456..."
	}
}
```

### `completion.recorded`

Fired after a completion is successfully recorded via
`POST /api/provider/completions`.

```json
{
	"event": "completion.recorded",
	"occurred_at": "2026-05-30T10:01:00Z",
	"data": {
		"completion_id": 101,
		"learner_address": "GBWD7...",
		"course_id": 42,
		"milestone_id": 7
	}
}
```

### Delivery headers

Every webhook delivery includes these HTTP headers:

| Header                   | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `X-LearnVault-Event`     | Event type string (e.g. `milestone.completed`) |
| `X-LearnVault-Signature` | HMAC-SHA256 signature for payload verification |
| `X-LearnVault-Delivery`  | Unique delivery ID                             |

### Retry policy

If your endpoint does not return a `2xx` response within 10 seconds, the
delivery is marked as failed. A webhook whose `failure_count` exceeds 15 is
automatically disabled. Monitor failures via
`GET /api/provider/webhooks/:id/deliveries` and re-enable by deleting and
re-registering the webhook once the issue is resolved.

---

## Webhook Signature Verification

Verify that incoming webhook requests genuinely originate from LearnVault.

**Signature header format:**

```
X-LearnVault-Signature: t=1748592000,v1=abc123def456...
```

**Verification algorithm:**

1. Extract `t` (timestamp) and `v1` (HMAC hex) from the header.
2. Reject if `|now - t| > 300` seconds (replay protection).
3. Build the signed string: `<t>.<raw_request_body>`.
4. Compute `HMAC-SHA256(<signed_string>, <signing_secret>)`.
5. Compare with `v1` using a constant-time comparison.

**Using the SDK:**

```typescript
import { verifyWebhookSignature } from "@learnvault/provider-sdk"

app.post("/webhooks/learnvault", (req, res) => {
	const isValid = verifyWebhookSignature({
		payload: JSON.stringify(req.body),
		signature: req.headers["x-learnvault-signature"] as string,
		secret: process.env.LEARNVAULT_WEBHOOK_SECRET!,
	})

	if (!isValid) {
		return res.status(401).json({ error: "Invalid signature" })
	}

	// process event…
	res.status(200).json({ received: true })
})
```

**Manual verification (Node.js):**

```typescript
import crypto from "crypto"

function verifySignature(
	rawBody: string,
	header: string,
	secret: string,
): boolean {
	const parts = Object.fromEntries(
		header.split(",").map((c) => c.split("=", 2) as [string, string]),
	)
	const timestamp = parseInt(parts["t"] ?? "", 10)
	const received = parts["v1"]

	if (!timestamp || !received) return false
	if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false

	const expected = crypto
		.createHmac("sha256", secret)
		.update(`${timestamp}.${rawBody}`)
		.digest("hex")

	return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}
```

---

## SDK — @learnvault/provider-sdk

The official TypeScript SDK ships with zero runtime dependencies and supports
Node.js ≥ 18, edge runtimes (Cloudflare Workers, Vercel Edge), and modern
browsers.

### Installation

```bash
npm install @learnvault/provider-sdk
# or
yarn add @learnvault/provider-sdk
# or
pnpm add @learnvault/provider-sdk
```

### Quick start

```typescript
import { LearnVaultProviderClient } from "@learnvault/provider-sdk"

const client = new LearnVaultProviderClient({
	apiKey: process.env.LEARNVAULT_API_KEY!,
	// baseUrl defaults to "https://api.learnvault.app"
})

// Submit a course
const course = await client.submitCourse({
	title: "DeFi on Stellar",
	slug: "defi-on-stellar",
	difficulty: "intermediate",
	track: "defi",
	external_url: "https://myacademy.io/defi-stellar",
})
console.log("Created course:", course.id)

// Report a completion
const completion = await client.reportCompletion({
	learner_address: "GBWD7LRWSSBZQCQDFLQ5BHBZQFPQRG6VVKZ3DPANRTMHW7XZMN3YDDB",
	course_id: course.id,
})
console.log("Completion recorded:", completion.id)

// Check LRN balance
const { lrn_balance } = await client.getLrnBalance("GBWD7...")
console.log("LRN balance:", Number(lrn_balance) / 10_000_000)

// Register a webhook
const webhook = await client.registerWebhook({
	url: "https://myacademy.io/webhooks/learnvault",
	events: ["milestone.completed", "completion.recorded"],
})
// Save webhook.signing_secret — it won't be shown again
```

### SDK API reference

| Method                         | Description                        |
| ------------------------------ | ---------------------------------- |
| `submitCourse(params)`         | Submit a new course                |
| `listCourses(opts?)`           | List courses you own               |
| `reportCompletion(params)`     | Record a learner completion        |
| `listCompletions(opts?)`       | List completions you recorded      |
| `getLrnBalance(address)`       | Get LRN balance for an address     |
| `registerWebhook(params)`      | Register a webhook endpoint        |
| `listWebhooks()`               | List your registered webhooks      |
| `deleteWebhook(id)`            | Remove a webhook                   |
| `listWebhookDeliveries(id)`    | Get delivery history for a webhook |
| `verifyWebhookSignature(opts)` | Verify an incoming webhook payload |

---

## Admin — Managing Provider Keys

These endpoints require LearnVault admin authentication (Bearer JWT with an
address in `ADMIN_ADDRESSES`).

### Create a provider key

```
POST /api/admin/provider-keys
Authorization: Bearer <admin-jwt>
```

**Request body:**

```json
{
	"provider_name": "My Academy",
	"scopes": [
		"courses:write",
		"completions:write",
		"lrn:read",
		"webhooks:write"
	],
	"rate_limit_per_minute": 120
}
```

| Field                   | Type       | Default    | Description                        |
| ----------------------- | ---------- | ---------- | ---------------------------------- |
| `provider_name`         | `string`   | —          | Display name for the provider      |
| `scopes`                | `string[]` | all scopes | Capability set granted to this key |
| `rate_limit_per_minute` | `number`   | `60`       | Max `1000`                         |

**Response `201 Created`:**

```json
{
	"data": {
		"id": 1,
		"provider_name": "My Academy",
		"key_prefix": "lvpk_a1b2",
		"scopes": [
			"courses:write",
			"completions:write",
			"lrn:read",
			"webhooks:write"
		],
		"rate_limit_per_minute": 120,
		"is_active": true,
		"created_by": "GADMIN...",
		"created_at": "2026-05-30T10:00:00Z",
		"last_used_at": null,
		"api_key": "lvpk_a1b2c3d4e5f6..."
	}
}
```

The `api_key` field is the full key — share it with the provider and do not log
it.

### List all provider keys

```
GET /api/admin/provider-keys
Authorization: Bearer <admin-jwt>
```

### Update a provider key

```
PATCH /api/admin/provider-keys/:id
Authorization: Bearer <admin-jwt>
```

```json
{ "rate_limit_per_minute": 200, "scopes": ["lrn:read"] }
```

### Revoke a provider key

```
DELETE /api/admin/provider-keys/:id
Authorization: Bearer <admin-jwt>
```

Returns `204 No Content`. Revocation is immediate and permanent — create a new
key if access needs to be restored.

---

## Error Reference

All provider endpoints use the standard LearnVault error envelope. See
[docs/api/error-codes.md](./error-codes.md) for the full reference.

| Status | Scenario                                                                 |
| ------ | ------------------------------------------------------------------------ |
| `400`  | Missing required field, invalid scope, invalid difficulty, URL not HTTPS |
| `401`  | Missing or invalid `X-Provider-API-Key`                                  |
| `403`  | Valid key but missing required scope                                     |
| `404`  | Course or webhook not found, or not owned by this provider key           |
| `409`  | Slug already exists, completion already recorded                         |
| `429`  | Rate limit exceeded — check `Retry-After` header                         |
| `500`  | Unexpected server error — include `X-Request-ID` in support tickets      |
