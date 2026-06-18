# Design Document: Zod Validation Middleware

## Overview

The server currently has two validation patterns that diverge: `validation.middleware.ts` throws an `AppError` (caught by the error handler as `{ error: string }`), while several other routes perform ad-hoc `if (!field)` checks and return their own 400 shapes. Neither exposes structured field-level error details to clients.

This design replaces both patterns with a single `validate(schema)` middleware factory at `server/src/middleware/validate.ts`. It returns raw `ZodIssue[]` on failure — giving clients the exact field path and message without any intermediate transformation — and updates the OpenAPI spec to document that shape.

The existing `validation.middleware.ts` is **deprecated** by this change. Routes that already import from it (`courses.routes.ts`, `validator.routes.ts`) are migrated to the new file.

---

## Architecture

The middleware sits between Express's `json()` body-parser and the route controller. The flow for a mutating request is:

```
Client Request
     │
     ▼
express.json()          ← parses raw body into req.body
     │
     ▼
auth / rate-limit       ← existing middleware (unchanged)
     │
     ▼
validate(schema)        ← NEW: parses body/query/params with Zod
     │                     success → coerced values written back, next()
     │                     failure → 400 { errors: ZodIssue[] }, no next()
     ▼
Controller              ← receives clean, typed req.body
```

No changes are needed to `index.ts` or the global error handler for the happy path. The validate middleware short-circuits with `res.status(400).json(...)` on failure — it does **not** throw, so `AppError` and the existing error handler remain untouched.

---

## Components and Interfaces

### `server/src/middleware/validate.ts` (new file)

```typescript
import { type NextFunction, type Request, type Response } from "express"
import { type ZodIssue, type ZodTypeAny } from "zod"

type SchemaMap = {
  body?:   ZodTypeAny
  query?:  ZodTypeAny
  params?: ZodTypeAny
}

export function validate(schemas: SchemaMap) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const issues: ZodIssue[] = []

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body)
      if (result.success) req.body = result.data
      else issues.push(...result.error.issues)
    }
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query)
      if (result.success) req.query = result.data
      else issues.push(...result.error.issues)
    }
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params)
      if (result.success) req.params = result.data as Request["params"]
      else issues.push(...result.error.issues)
    }

    if (issues.length > 0) {
      res.status(400).json({ errors: issues })
      return
    }
    next()
  }
}
```

Key design decisions:
- Uses `safeParse` (never throws) so the middleware is the sole 400 path for schema errors.
- Collects issues from all failing schemas before responding, so clients get a complete error list in one round-trip.
- Writes coerced data back to `req.body`/`req.query`/`req.params` on success, enabling Zod transforms (e.g. `z.coerce.number()`).

### `server/src/lib/zod-schemas.ts` (extended)

New schemas added alongside the existing ones:

| Export | Used by |
|--------|---------|
| `verifyBodySchema` | `POST /api/auth/verify` |
| `postCommentBodySchema` | `POST /api/comments` |
| `voteCommentBodySchema` | `PUT /api/comments/:id/vote` |
| `submitMilestoneBodySchema` | `POST /api/milestones/submit` |
| `rejectMilestoneBodySchema` | `POST /api/admin/milestones/:id/reject` |

Existing exports (`courseIdParamSchema`, `validateMilestoneSchema`) are unchanged.

### Route files modified

| File | Change |
|------|--------|
| `auth.routes.ts` | Add `validate({ body: verifyBodySchema })` to `POST /verify` |
| `comments.routes.ts` | Add `validate({ body: postCommentBodySchema })` to `POST /comments`; add `validate({ body: voteCommentBodySchema })` to `PUT /comments/:id/vote` |
| `admin-milestones.routes.ts` | Add `validate({ body: rejectMilestoneBodySchema })` to `POST .../reject`; add `validate({ body: submitMilestoneBodySchema })` to `POST /milestones/submit` |
| `courses.routes.ts` | Update import from `validate` in `validation.middleware` → `validate.ts` |
| `validator.routes.ts` | Update import similarly |

### `server/src/openapi.ts` (updated)

Two new component schemas and one new response component:

```
components.schemas.ZodIssue
components.schemas.ValidationErrorResponse
components.responses.ForbiddenError        ← was missing, referenced in routes
components.responses.BadRequestError       ← updated to reference ValidationErrorResponse
```

---

## Data Models

### `ValidationErrorResponse`

```json
{
  "errors": [
    {
      "code": "invalid_type",
      "path": ["body", "walletAddress"],
      "message": "Expected string, received undefined"
    }
  ]
}
```

### `ZodIssue` (OpenAPI schema fragment)

```yaml
ZodIssue:
  type: object
  required: [code, path, message]
  properties:
    code:
      type: string
      example: invalid_type
    path:
      type: array
      items:
        oneOf:
          - type: string
          - type: integer
      example: ["walletAddress"]
    message:
      type: string
      example: "Required"
```

### New Zod schemas

```typescript
// auth verify
export const verifyBodySchema = z.object({
  walletAddress: z.string().min(1),
  signature: z.string().min(1),
})

// comment creation
export const postCommentBodySchema = z.object({
  proposalId: z.string().min(1),
  content:    z.string().min(1),
  parentId:   z.string().optional(),
})

// comment vote
export const voteCommentBodySchema = z.object({
  type: z.enum(["upvote", "downvote"]),
})

// milestone submit — at least one evidence field required
export const submitMilestoneBodySchema = z.object({
  scholarAddress:       z.string().min(1),
  courseId:             z.string().min(1),
  milestoneId:          z.number().int().nonnegative(),
  evidenceGithub:       z.string().url().optional(),
  evidenceIpfsCid:      z.string().optional(),
  evidenceDescription:  z.string().optional(),
}).refine(
  (d) => d.evidenceGithub || d.evidenceIpfsCid || d.evidenceDescription,
  { message: "At least one evidence field is required", path: ["evidenceDescription"] },
)

// milestone reject
export const rejectMilestoneBodySchema = z.object({
  reason: z.string().min(1),
})
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid input passthrough

*For any* schema map and any request whose `body`, `query`, and `params` all conform to their respective schemas, the middleware should call `next()` exactly once and assign the Zod-coerced values back to the corresponding request properties.

**Validates: Requirements 1.2**

---

### Property 2: Invalid input produces 400 with ZodIssue array

*For any* schema map and any request where at least one of `body`, `query`, or `params` does **not** conform to its schema, the middleware should respond with HTTP 400 and a JSON body of shape `{ errors: ZodIssue[] }` where `errors` is non-empty, and should **not** call `next()`.

**Validates: Requirements 1.3, 3.1, 3.2**

---

### Property 3: Every ZodIssue has a path and message

*For any* validation failure, every element in the `errors` array must have a `path` field that is an array (possibly empty) and a `message` field that is a non-empty string.

**Validates: Requirements 3.3**

---

### Property 4: Vote type constraint

*For any* request to `PUT /api/comments/:id/vote`, only the literal strings `"upvote"` and `"downvote"` should pass schema validation. Any other string value for the `type` field should produce a 400 with `errors`.

**Validates: Requirements 2.4**

---

### Property 5: Submit milestone evidence invariant

*For any* request to `POST /api/milestones/submit` that omits all three evidence fields (`evidenceGithub`, `evidenceIpfsCid`, `evidenceDescription`), the schema should reject the payload with a 400. Providing any one of them should pass the evidence check.

**Validates: Requirements 2.5**

---

## Error Handling

| Scenario | HTTP Status | Response body |
|----------|------------|---------------|
| Schema validation failure | 400 | `{ errors: ZodIssue[] }` |
| Missing/non-JSON body (Express json() sets body to `{}`) | 400 (caught by Zod `required` fields) | `{ errors: ZodIssue[] }` |
| Auth failure (separate middleware) | 401 | `{ error: "Unauthorized" }` (unchanged) |
| Controller runtime error | 500 | `{ error: "..." }` via errorHandler (unchanged) |

The validate middleware **does not** call `next(err)` — it responds directly. This keeps validation errors cleanly separated from unhandled exceptions.

---

## Testing Strategy

Tests use the existing **Jest + supertest** setup. No new dependencies are needed.

### Unit tests — validate middleware in isolation

Test the middleware function directly using mock `req`, `res`, and `next` objects (or a minimal Express app). Cover:
- Valid body: `next()` called, `req.body` contains coerced values
- Invalid body: `res.status(400).json({ errors })` called, `next()` not called
- Valid params: `next()` called, `req.params` updated
- Invalid params: 400 with `errors`
- Multi-schema failure (body + params both invalid): single response with combined `errors`

### Integration tests — route-level

Build a minimal Express app per test suite (same pattern as `admin-milestones.test.ts`):

**`POST /api/validator/validate`** — existing coverage, extend with:
- Valid payload → 200
- Missing `milestoneId` → 400 `{ errors: ZodIssue[] }`

**`POST /api/comments`** — new tests:
- Valid `{ proposalId, content }` → 201
- Missing `content` → 400 `{ errors: ZodIssue[] }`

**`PUT /api/comments/:id/vote`** — new tests:
- Valid `{ type: "upvote" }` → 200
- `{ type: "like" }` → 400 `{ errors: ZodIssue[] }`

**`POST /api/milestones/submit`** — extend existing:
- Valid payload with evidence → 201
- Missing all evidence fields → 400 `{ errors: ZodIssue[] }`

### Property-based tests

Use a property-based testing library — **[fast-check](https://fast-check.dev/)** (TypeScript-native, Jest-compatible) — to implement the properties listed above.

Each property-based test runs a minimum of **100 iterations**.

Tag format per test: `// Feature: zod-validation-middleware, Property N: <property text>`

- **Property 1** — generate random valid objects matching a schema; assert `next()` called
- **Property 2** — generate objects with at least one field mutated to the wrong type; assert 400 + non-empty `errors`
- **Property 3** — generate any invalid payload; assert every item in `errors` has `path` (array) and `message` (non-empty string)
- **Property 4** — generate arbitrary strings; only `"upvote"` / `"downvote"` should pass `voteCommentBodySchema`
- **Property 5** — generate submit payloads with/without evidence fields; assert refine logic
