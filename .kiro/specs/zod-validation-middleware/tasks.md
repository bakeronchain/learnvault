# Implementation Plan: Zod Validation Middleware

## Overview

Implement the `validate(schema)` middleware factory, extend `zod-schemas.ts` with new route schemas, apply validation to all POST/PUT/PATCH routes, update the OpenAPI spec, and add unit + property-based tests.

## Tasks

- [~] 1. Create `server/src/middleware/validate.ts`
  - Implement the `validate(schemas)` factory using `safeParse` on `body`, `query`, and `params`
  - Collect `ZodIssue[]` from all failing schemas before responding
  - On failure: `res.status(400).json({ errors: issues })` with no `next()` call
  - On success: write coerced values back to `req.body`/`req.query`/`req.params`, then call `next()`
  - Export as named export `validate`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 1.1 Write unit tests for `validate` middleware in isolation
    - Test valid body → `next()` called, `req.body` updated
    - Test invalid body → 400 `{ errors: ZodIssue[] }`, `next()` not called
    - Test valid params → `next()` called, `req.params` updated
    - Test invalid params → 400 `{ errors: ZodIssue[] }`
    - Test body + params both invalid → single 400 response with combined `errors`
    - _Requirements: 5.1_

- [ ] 2. Add new Zod schemas to `server/src/lib/zod-schemas.ts`
  - Add `verifyBodySchema` (walletAddress: string min 1, signature: string min 1)
  - Add `postCommentBodySchema` (proposalId: string min 1, content: string min 1, parentId?: string)
  - Add `voteCommentBodySchema` (type: z.enum(["upvote", "downvote"]))
  - Add `submitMilestoneBodySchema` with `.refine()` requiring at least one evidence field
  - Add `rejectMilestoneBodySchema` (reason: string min 1)
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.1 Write property test: valid input passthrough (Property 1)
    - Install `fast-check` as a dev dependency
    - **Property 1: Valid input passthrough**
    - **Validates: Requirements 1.2**
    - Generate random valid objects matching a schema; assert `next()` is called and `req.body` is updated
    - Minimum 100 iterations
    - `// Feature: zod-validation-middleware, Property 1: valid input passthrough`

  - [ ]* 2.2 Write property test: invalid input produces 400 with ZodIssue array (Property 2)
    - **Property 2: Invalid input produces 400 with ZodIssue array**
    - **Validates: Requirements 1.3, 3.1, 3.2**
    - Generate objects with at least one field mutated to the wrong type; assert 400 and non-empty `errors`
    - Minimum 100 iterations
    - `// Feature: zod-validation-middleware, Property 2: invalid input produces 400 with ZodIssue array`

  - [ ]* 2.3 Write property test: every ZodIssue has path and message (Property 3)
    - **Property 3: Every ZodIssue has a path and message**
    - **Validates: Requirements 3.3**
    - For any invalid payload, assert every element in `errors` has `path` (array) and `message` (non-empty string)
    - Minimum 100 iterations
    - `// Feature: zod-validation-middleware, Property 3: every ZodIssue has path and message`

  - [ ]* 2.4 Write property test: vote type literal constraint (Property 4)
    - **Property 4: Vote type constraint**
    - **Validates: Requirements 2.4**
    - Generate arbitrary strings; assert only `"upvote"` / `"downvote"` pass `voteCommentBodySchema`
    - Minimum 100 iterations
    - `// Feature: zod-validation-middleware, Property 4: vote type constraint`

  - [ ]* 2.5 Write property test: submit milestone evidence invariant (Property 5)
    - **Property 5: Submit milestone evidence invariant**
    - **Validates: Requirements 2.5**
    - Generate submit payloads omitting all evidence fields; assert 400. Generate with at least one; assert pass
    - Minimum 100 iterations
    - `// Feature: zod-validation-middleware, Property 5: submit milestone evidence invariant`

- [ ] 3. Apply `validate` middleware to route files
  - Update `auth.routes.ts`: add `validate({ body: verifyBodySchema })` to `POST /verify`
  - Update `comments.routes.ts`: add `validate({ body: postCommentBodySchema })` to `POST /comments`; add `validate({ body: voteCommentBodySchema })` to `PUT /comments/:id/vote`; remove the manual `if (!proposalId || !content)` and `if (!["upvote", "downvote"].includes(type))` checks
  - Update `admin-milestones.routes.ts`: add `validate({ body: rejectMilestoneBodySchema })` to `POST .../reject`; add `validate({ body: submitMilestoneBodySchema })` to `POST /milestones/submit`
  - Update `courses.routes.ts` and `validator.routes.ts`: change import from `../middleware/validation.middleware` to `../middleware/validate`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ] 4. Checkpoint — ensure all existing tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Add integration tests for route-level validation
  - [ ] 5.1 Tests for `POST /api/validator/validate`
    - Valid payload → 200 with result body
    - Missing `milestoneId` → 400 `{ errors: ZodIssue[] }`
    - _Requirements: 5.2, 5.3_

  - [ ]* 5.2 Tests for `POST /api/comments`
    - Valid `{ proposalId, content }` → 201 with created comment
    - Missing `content` → 400 `{ errors: ZodIssue[] }`
    - _Requirements: 5.4, 5.5_

  - [ ]* 5.3 Tests for `PUT /api/comments/:id/vote`
    - Valid `{ type: "upvote" }` → proceeds past validation (200 or downstream error)
    - `{ type: "like" }` → 400 `{ errors: ZodIssue[] }`
    - _Requirements: 5.6, 5.7_

  - [ ]* 5.4 Tests for `POST /api/milestones/submit`
    - Valid payload with evidence → 201
    - Missing all evidence fields → 400 `{ errors: ZodIssue[] }`
    - _Requirements: 5.8, 5.9_

- [ ] 6. Update OpenAPI spec in `server/src/openapi.ts`
  - Add `ZodIssue` component schema (required: `code`, `path`, `message`)
  - Add `ValidationErrorResponse` component schema (`{ errors: ZodIssue[] }`)
  - Add `ForbiddenError` response component (was missing, referenced in several routes)
  - Update `BadRequestError` response component to reference `ValidationErrorResponse`
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 7. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- `fast-check` is required for property-based tests (tasks 2.1–2.5); install with `npm install --save-dev fast-check` in the `server/` directory
- The existing `validation.middleware.ts` can be deleted once all imports are migrated in task 3
- Each property test must include the `// Feature: zod-validation-middleware, Property N:` comment tag
