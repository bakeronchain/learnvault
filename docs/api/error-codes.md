# API Error Codes Reference

This document is the authoritative reference for all HTTP status codes and error
responses returned by the LearnVault API.

## Table of Contents

- [Error Response Schema](#error-response-schema)
- [HTTP Status Codes](#http-status-codes)
- [Authentication & Authorization Errors](#authentication--authorization-errors)
- [Validation Errors](#validation-errors)
- [Resource Errors](#resource-errors)
- [Conflict Errors](#conflict-errors)
- [Rate Limit Errors](#rate-limit-errors)
- [External Service Errors](#external-service-errors)
- [Server Errors](#server-errors)
- [Client-Side Handling Guide](#client-side-handling-guide)

---

## Error Response Schema

All error responses share a consistent JSON envelope:

```json
{
	"error": "string",
	"message": "string",
	"details": "string | object[] (optional)",
	"stack": "string (non-production only)"
}
```

| Field     | Type                 | Always present | Description                                                 |
| --------- | -------------------- | -------------- | ----------------------------------------------------------- |
| `error`   | `string`             | Yes            | Short error label                                           |
| `message` | `string`             | Yes            | Human-readable description                                  |
| `details` | `string \| object[]` | No             | Additional context; see per-error documentation below       |
| `stack`   | `string`             | No             | Stack trace; only included when `NODE_ENV !== "production"` |

### Validation error `details` shape

When the error is a schema-validation failure (status `400`), `details` is an
array of field-level issues:

```json
{
	"error": "Validation failed",
	"message": "Validation failed",
	"details": [
		{
			"field": "body.title",
			"message": "String must contain at least 1 character"
		},
		{ "field": "body.difficulty", "message": "Invalid difficulty" }
	]
}
```

---

## HTTP Status Codes

| Code  | Name                  | When used                                                      |
| ----- | --------------------- | -------------------------------------------------------------- |
| `200` | OK                    | Successful read or action                                      |
| `201` | Created               | Resource created successfully                                  |
| `204` | No Content            | Successful action with no body (e.g., DELETE)                  |
| `400` | Bad Request           | Validation failure, missing fields, or invalid input           |
| `401` | Unauthorized          | Missing or invalid authentication token                        |
| `403` | Forbidden             | Authenticated but not permitted for this resource or action    |
| `404` | Not Found             | Resource or route does not exist                               |
| `409` | Conflict              | Request conflicts with current state (duplicate, wrong status) |
| `410` | Gone                  | Resource permanently expired (e.g., verification token)        |
| `429` | Too Many Requests     | Rate limit exceeded                                            |
| `500` | Internal Server Error | Unexpected server-side failure                                 |
| `502` | Bad Gateway           | External service (e.g., Stellar contract) returned an error    |
| `503` | Service Unavailable   | Required external dependency is not configured or reachable    |

---

## Authentication & Authorization Errors

### 401 Unauthorized

Returned when a request lacks a valid JWT or the token cannot be verified.

```json
{ "error": "Unauthorized", "message": "Unauthorized" }
```

```json
{ "error": "Invalid token", "message": "Invalid token" }
```

```json
{ "error": "Invalid or expired token", "message": "Invalid or expired token" }
```

```json
{
	"error": "Token missing address claim",
	"message": "Token missing address claim"
}
```

```json
{
	"error": "JWT verification not configured",
	"message": "JWT verification not configured"
}
```

**When encountered:**

| Message                           | Trigger                                                   |
| --------------------------------- | --------------------------------------------------------- |
| `Unauthorized`                    | No `Authorization` header, or token signature invalid     |
| `Invalid token`                   | Token failed JWT verification in `auth.middleware.ts`     |
| `Invalid or expired token`        | Admin-scoped token expired or malformed                   |
| `Token missing address claim`     | JWT payload does not contain the required `address` field |
| `JWT verification not configured` | `JWT_SECRET` environment variable is not set              |

**Example — missing token:**

```http
GET /api/v1/courses/my-course HTTP/1.1

HTTP/1.1 401 Unauthorized
Content-Type: application/json

{ "error": "Unauthorized", "message": "Unauthorized" }
```

---

### 403 Forbidden

Returned when the caller is authenticated but does not have permission for the
requested action.

```json
{ "error": "Forbidden", "message": "Forbidden" }
```

```json
{
	"error": "Forbidden: untrusted origin",
	"message": "Forbidden: untrusted origin"
}
```

```json
{
	"error": "Forbidden: untrusted referer",
	"message": "Forbidden: untrusted referer"
}
```

**When encountered:**

| Message                        | Trigger                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `Forbidden`                    | User is not an admin or course admin for the target resource |
| `Forbidden: untrusted origin`  | `Origin` header failed CSRF/CORS validation                  |
| `Forbidden: untrusted referer` | `Referer` header failed CSRF validation                      |

**Example — non-admin accessing admin endpoint:**

```http
DELETE /api/v1/admin/courses/123 HTTP/1.1
Authorization: Bearer <user-token>

HTTP/1.1 403 Forbidden
Content-Type: application/json

{ "error": "Forbidden", "message": "Forbidden" }
```

---

## Validation Errors

### 400 Bad Request — schema validation

Schema validation is performed via Zod. Any request that fails validation
returns `400` with a `details` array.

```json
{
	"error": "Validation failed",
	"message": "Validation failed",
	"details": [
		{
			"field": "body.title",
			"message": "String must contain at least 1 character"
		}
	]
}
```

**Common validation messages:**

| Message                                                | Context                                                        |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| `"<field> is required"`                                | Required field missing                                         |
| `"title cannot be empty"`                              | Course or lesson title is an empty string                      |
| `"Invalid difficulty"`                                 | `difficulty` not one of `beginner`, `intermediate`, `advanced` |
| `"prerequisites must be an array of course IDs"`       | Prerequisites field is not an array                            |
| `"prerequisites must be an array of integers"`         | Prerequisites array contains non-integer values                |
| `"A course cannot be a prerequisite of itself"`        | Self-referential prerequisite                                  |
| `"One or more prerequisite course IDs do not exist"`   | Referenced course missing                                      |
| `"orderIndex must be a positive integer"`              | Lesson ordering value invalid                                  |
| `"ids must be a non-empty array of positive integers"` | Bulk-operation ID array invalid                                |

### 400 Bad Request — business logic

These are explicit validation rejections thrown by controllers rather than
schema middleware.

**Authentication / wallet:**

| Message                                         | Trigger                                             |
| ----------------------------------------------- | --------------------------------------------------- |
| `"Missing query parameter: address"`            | `address` not supplied to challenge/nonce endpoints |
| `"Missing required fields: address, signature"` | Signature verification payload incomplete           |
| `"Invalid verification method"`                 | Unknown anti-sybil verification type                |

**Profile:**

| Message                                                    | Trigger                                        |
| ---------------------------------------------------------- | ---------------------------------------------- |
| `"Avatar CID must be a valid IPFS CID"`                    | Avatar uploaded with invalid CID               |
| `"Avatar URL must be a valid URL with max 500 characters"` | Avatar URL malformed or too long               |
| `"Bio must be a string with max 1000 characters"`          | Bio exceeds length limit                       |
| `"Display name must be a string with max 100 characters"`  | Display name exceeds length limit              |
| `"Social links must be an object"`                         | Social links payload is not a key-value object |
| `"Invalid <platform> link"`                                | A social link URL failed validation            |
| `"Invalid Stellar address"`                                | Stellar public key format invalid              |

**Milestone & governance:**

| Message                                                           | Trigger                                     |
| ----------------------------------------------------------------- | ------------------------------------------- |
| `"Appeal reason is required"`                                     | Appeal submitted without a reason           |
| `"Appeal reason must be 2000 characters or fewer"`                | Appeal reason exceeds length limit          |
| `"Evidence description must be 2000 characters or fewer"`         | Evidence field exceeds length limit         |
| `"Rejection reason is required"`                                  | Admin rejection submitted without reason    |
| `"Rejection reason must be 1000 characters or fewer"`             | Rejection reason exceeds length limit       |
| `"reason is required when rejecting an appeal"`                   | Appeal rejection missing reason             |
| `"Milestone report ID is required"`                               | No report ID provided to milestone endpoint |
| `"Invalid milestone report id"`                                   | Report ID is not a valid integer            |
| `"Invalid milestone status filter"`                               | Unknown status value in query parameter     |
| `"No milestone report IDs provided"`                              | Batch operation sent with empty list        |
| `"One or more milestone reports were not found"`                  | Batch references unknown report IDs         |
| `"One or more milestone reports are not pending"`                 | Batch operation targets non-pending reports |
| `"All milestone reports must be pending before batch processing"` | Mixed-status batch attempt                  |
| `"Invalid vote type"`                                             | Vote is not `for` or `against`              |
| `"Voting is closed for this proposal"`                            | Proposal voting period has ended            |
| `"You have no voting power"`                                      | Caller holds no LRN at snapshot block       |
| `"Only open or queued proposals can be cancelled"`                | Cancel attempted on wrong-status proposal   |
| `"Invalid proposal id"`                                           | Proposal ID not a valid integer             |

**Content & uploads:**

| Message                                       | Trigger                               |
| --------------------------------------------- | ------------------------------------- |
| `"No file provided"`                          | Upload endpoint called without a file |
| `"Invalid file type"`                         | Uploaded MIME type not allowed        |
| `"content is required"`                       | Post or comment body is empty         |
| `"title is required"`                         | Thread or proposal title is empty     |
| `"Comment must be 2,000 characters or fewer"` | Comment body exceeds limit            |
| `"Reason must be at least 10 characters"`     | Moderation reason too short           |
| `"reason must be 1000 characters or fewer"`   | Moderation reason too long            |
| `"Invalid content type"`                      | Unknown content type for flagging     |
| `"Invalid action"`                            | Unknown action parameter              |

**Token / burn:**

| Message                 | Trigger                              |
| ----------------------- | ------------------------------------ |
| `"Invalid burn amount"` | Burn amount is not a positive number |
| `"Invalid burn reason"` | Burn reason is not an allowed value  |

**Example — missing required field:**

```http
POST /api/v1/courses HTTP/1.1
Content-Type: application/json

{ "description": "A course without a title" }

HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Validation failed",
  "message": "Validation failed",
  "details": [
    { "field": "body.title", "message": "title is required" }
  ]
}
```

---

## Resource Errors

### 404 Not Found — resource missing

```json
{ "error": "Course not found", "message": "Course not found" }
```

| Message                             | Resource                      |
| ----------------------------------- | ----------------------------- |
| `"Course not found"`                | Course by slug or ID          |
| `"Lesson not found"`                | Lesson within a course        |
| `"Active lesson version not found"` | Published version of a lesson |
| `"Thread not found"`                | Forum thread                  |
| `"Comment not found"`               | Comment on a thread           |
| `"Proposal not found"`              | Governance proposal           |
| `"Milestone report not found"`      | Scholar milestone submission  |
| `"Profile not found"`               | User or scholar profile       |
| `"Mentor profile not found"`        | Mentor profile                |
| `"Organization profile not found"`  | Sponsor or DAO org profile    |
| `"Wiki page not found"`             | Course wiki page              |
| `"Notification not found"`          | Push notification record      |
| `"Flag not found"`                  | Content moderation flag       |

### 404 Not Found — route missing

When a request is made to a path that does not exist:

```json
{
	"error": "Not Found",
	"message": "Route /api/v1/unknown-path not found"
}
```

---

## Conflict Errors

### 409 Conflict

Returned when the request is well-formed but conflicts with current state.

```json
{
	"error": "Already enrolled in this course",
	"message": "Already enrolled in this course"
}
```

| Message                                                    | Trigger                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| `"Slug already exists"`                                    | Course or wiki page created with a duplicate slug            |
| `"Already enrolled in this course"`                        | Duplicate enrollment attempt                                 |
| `"A report for this milestone has already been submitted"` | Scholar submits the same milestone twice                     |
| `"Report already <status>"`                                | Admin attempts to approve/reject an already-processed report |
| `"Only rejected milestones can be resubmitted"`            | Resubmission attempted on a non-rejected milestone           |
| `"You have already voted on this proposal"`                | Duplicate governance vote                                    |
| `"Only open or queued proposals can be cancelled"`         | Cancel attempted on resolved/cancelled proposal              |
| `"Proposal is already cancelled"`                          | Cancel attempted on an already-cancelled proposal            |

**Example — duplicate enrollment:**

```http
POST /api/v1/enrollments HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{ "courseId": 42 }

HTTP/1.1 409 Conflict
Content-Type: application/json

{ "error": "Already enrolled in this course", "message": "Already enrolled in this course" }
```

---

### 410 Gone

Returned for resources that existed but have permanently expired.

| Message                  | Trigger                                                  |
| ------------------------ | -------------------------------------------------------- |
| `"Verification expired"` | Anti-sybil verification token/session has passed its TTL |

---

## Rate Limit Errors

### 429 Too Many Requests

All rate-limited endpoints return `429` with a plain message. Retry timing is
communicated via the standard `Retry-After` header.

```json
{
	"error": "Too many requests, please try again later.",
	"message": "Too many requests, please try again later."
}
```

| Message                                                                            | Limit                 | Window              |
| ---------------------------------------------------------------------------------- | --------------------- | ------------------- |
| `"Too many requests, please try again later."`                                     | 100 requests          | 60 seconds (global) |
| `"Upload limit reached. You can upload 5 times per minute."`                       | 5 uploads             | 60 seconds          |
| `"Milestone report limit reached. You can submit 3 reports per hour."`             | 3 reports             | 60 minutes          |
| `"Proposal limit reached. You can submit 1 proposal per day."`                     | 1 proposal            | 24 hours            |
| `"Verification limit reached. You can verify up to 10 times every 15 minutes."`    | 10 verifications      | 15 minutes          |
| `"Application limit reached. You can submit 3 scholarship applications per hour."` | 3 applications        | 60 minutes          |
| `"Voting limit reached. You can submit 20 governance votes per hour."`             | 20 votes              | 60 minutes          |
| `"Milestone limit reached. You can submit 10 milestone reports per hour."`         | 10 milestone reports  | 60 minutes          |
| `"Too many nonce requests; try again later"`                                       | Comment nonce         | Per route config    |
| `"Too many milestone submissions; try again later"`                                | Milestone submissions | Per route config    |

**Example:**

```http
POST /api/v1/governance/proposals HTTP/1.1
Authorization: Bearer <token>

HTTP/1.1 429 Too Many Requests
Retry-After: 86400
Content-Type: application/json

{
  "error": "Proposal limit reached. You can submit 1 proposal per day.",
  "message": "Proposal limit reached. You can submit 1 proposal per day."
}
```

---

## External Service Errors

### 502 Bad Gateway

Returned when an on-chain call to the Stellar smart contract fails after the
database record is already written.

```json
{
	"error": "Contract call failed. Appeal resolution not committed.",
	"message": "Contract call failed. Appeal resolution not committed."
}
```

**When encountered:** The milestone appeal controller successfully updates the
database but the subsequent Stellar contract invocation fails. The client should
treat the operation as partially failed and contact support or retry after
verifying on-chain state.

---

### 503 Service Unavailable

Returned when a required external dependency is not configured in the server
environment.

```json
{
	"error": "Stellar credentials not configured",
	"message": "Stellar credentials not configured"
}
```

| Message                                | Cause                                            |
| -------------------------------------- | ------------------------------------------------ |
| `"Stellar credentials not configured"` | `STELLAR_SECRET_KEY` or related env vars missing |
| `"Service unavailable"`                | Generic external dependency unavailable          |

**Health check sub-errors** (returned in health endpoint response body, not as
top-level errors):

| Message                                     | Cause                                             |
| ------------------------------------------- | ------------------------------------------------- |
| `"DB ping returned no rows"`                | Database liveness check failed                    |
| `"Unexpected Redis PING response: <value>"` | Redis health check returned unexpected value      |
| `"Horizon returned HTTP <status>"`          | Stellar Horizon API returned a non-success status |

---

## Server Errors

### 500 Internal Server Error

Returned for unexpected failures. In production, the message is always
`"Internal Server Error"`. In non-production environments the actual error
message is surfaced.

```json
{ "error": "Internal Server Error", "message": "Internal Server Error" }
```

Common patterns (non-production only):

| Pattern                                       | Trigger                                |
| --------------------------------------------- | -------------------------------------- |
| `"Failed to fetch <resource>"`                | Database query failed                  |
| `"Failed to create <resource>"`               | Insert operation failed                |
| `"Failed to update <resource>"`               | Update operation failed                |
| `"Failed to delete <resource>"`               | Delete operation failed                |
| `"Failed to submit <operation>"`              | Submission pipeline failed             |
| `"Failed to batch approve/reject milestones"` | Bulk admin operation failed            |
| `"Failed to vote"` / `"Failed to cast vote"`  | Governance vote write failed           |
| `"Failed to resolve appeal"`                  | Appeal resolution write failed         |
| `"Failed to generate certificate"`            | Certificate generation pipeline failed |
| `"Failed to pin metadata to IPFS"`            | IPFS upload failed                     |

All `500` errors are automatically captured by Sentry with the request ID, path,
and method for internal triage.

---

## Client-Side Handling Guide

### General strategy

```typescript
async function apiFetch(url: string, options?: RequestInit) {
	const res = await fetch(url, options)

	if (res.ok) return res.json()

	const body = await res
		.json()
		.catch(() => ({ error: "Unknown error", message: "Unknown error" }))

	switch (res.status) {
		case 400:
			// Show field-level errors from body.details if present
			handleValidationError(body)
			break
		case 401:
			// Redirect to wallet sign-in
			redirectToLogin()
			break
		case 403:
			// Show "you don't have permission" UI
			showForbiddenMessage(body.message)
			break
		case 404:
			// Show not-found state
			showNotFound(body.message)
			break
		case 409:
			// Inform the user about the state conflict
			showConflictMessage(body.message)
			break
		case 410:
			// Token/session expired — prompt user to restart the flow
			showExpiredMessage()
			break
		case 429: {
			// Back off and optionally show a countdown
			const retryAfter = res.headers.get("Retry-After")
			showRateLimitMessage(
				body.message,
				retryAfter ? Number(retryAfter) : undefined,
			)
			break
		}
		case 502:
			// Partial failure — advise user to verify on-chain state
			showPartialFailureMessage(body.message)
			break
		case 503:
			// Service down — show maintenance message
			showServiceUnavailable()
			break
		default:
			// 500 and unknown codes
			showGenericError()
	}

	throw new Error(body.message)
}
```

### Rendering validation errors

```typescript
function handleValidationError(body: {
	details?: { field: string; message: string }[]
}) {
	if (Array.isArray(body.details)) {
		for (const issue of body.details) {
			// issue.field is dot-separated, e.g. "body.title"
			const fieldName = issue.field.replace(/^body\./, "")
			setFieldError(fieldName, issue.message)
		}
	}
}
```

### Retrying rate-limited requests

```typescript
async function fetchWithBackoff(
	url: string,
	options?: RequestInit,
	maxRetries = 3,
) {
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		const res = await fetch(url, options)
		if (res.status !== 429) return res

		const retryAfter = Number(res.headers.get("Retry-After") ?? 60)
		await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
	}
	throw new Error("Rate limit exceeded after maximum retries")
}
```

### Handling the `X-Request-ID` header

Every API response includes an `X-Request-ID` header (set by the request-tracing
middleware). Include this in bug reports or support tickets — it allows the
engineering team to locate the exact Sentry event for a failed request.

```typescript
const requestId = response.headers.get("X-Request-ID")
```

---

_For the full OpenAPI spec see [docs/openapi.yaml](../openapi.yaml). For request
tracing details see [docs/request-tracing.md](../request-tracing.md)._
