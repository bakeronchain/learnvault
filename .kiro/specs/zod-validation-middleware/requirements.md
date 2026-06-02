# Requirements Document

## Introduction

LearnVault's Express server routes currently lack consistent input validation. Malformed request bodies, query strings, and route parameters can cause unexpected runtime errors or reach the database with invalid data. This feature standardises request validation by replacing ad-hoc checks with a single `validate(schema)` middleware factory powered by Zod, ensuring every mutating route (POST/PUT/PATCH) returns structured, field-level 400 errors and that the OpenAPI specification accurately reflects those responses.

## Glossary

- **Validate_Middleware**: The `validate(schema)` factory function located at `server/src/middleware/validate.ts` that parses `body`, `query`, and/or `params` against Zod schemas and calls `next()` on success.
- **ZodIssue**: A single validation error object as defined by Zod's `z.ZodIssue` type, containing at minimum `code`, `path`, and `message` fields.
- **ValidationErrorResponse**: The HTTP response body shape `{ errors: ZodIssue[] }` returned when validation fails.
- **Route**: An Express route handler registered on a Router for a specific HTTP method and path.
- **Schema**: A Zod object schema (`ZodObject` or similar) used to describe the expected shape of `body`, `query`, or `params`.
- **OpenAPI_Spec**: The OpenAPI 3.0.3 specification generated from JSDoc annotations and the `openapi.ts` component definitions.

## Requirements

### Requirement 1: Validate Middleware Factory

**User Story:** As a backend developer, I want a single reusable `validate` middleware factory, so that I can apply consistent Zod-based input validation to any route without duplicating parsing logic.

#### Acceptance Criteria

1. THE Validate_Middleware SHALL accept a schema map with optional `body`, `query`, and `params` keys, each holding a Zod schema.
2. WHEN all provided schemas parse successfully, THE Validate_Middleware SHALL call `next()` and attach the parsed, coerced values back to `req.body`, `req.query`, and `req.params` respectively.
3. WHEN any provided schema fails to parse, THE Validate_Middleware SHALL respond with HTTP status 400 and a body of `{ errors: ZodIssue[] }` containing the raw Zod issues.
4. WHEN multiple schemas are provided and more than one fails, THE Validate_Middleware SHALL include issues from all failing schemas in the single `errors` array.
5. THE Validate_Middleware SHALL be exported from `server/src/middleware/validate.ts` as a named export `validate`.

---

### Requirement 2: Application to Mutating Routes

**User Story:** As a backend developer, I want the validate middleware applied to all POST, PUT, and PATCH routes, so that no mutating endpoint accepts malformed input.

#### Acceptance Criteria

1. WHEN a POST, PUT, or PATCH route receives a request, THE Route SHALL apply the Validate_Middleware with an appropriate Zod schema before any controller logic executes.
2. THE Route for `POST /api/auth/verify` SHALL validate `body` against a schema requiring a non-empty `walletAddress` string and a non-empty `signature` string.
3. THE Route for `POST /api/comments` SHALL validate `body` against a schema requiring a non-empty `proposalId` string and a non-empty `content` string, with an optional `parentId` string.
4. THE Route for `PUT /api/comments/:id/vote` SHALL validate `body` against a schema requiring `type` to be one of the literal values `"upvote"` or `"downvote"`.
5. THE Route for `POST /api/milestones/submit` SHALL validate `body` against a schema requiring `scholarAddress` (non-empty string), `courseId` (non-empty string), `milestoneId` (non-negative integer), and at least one evidence field present.
6. THE Route for `POST /api/admin/milestones/:id/reject` SHALL validate `body` against a schema requiring a non-empty `reason` string.
7. THE Route for `POST /api/validator/validate` SHALL continue to use the existing `validateMilestoneSchema` via the Validate_Middleware.

---

### Requirement 3: Validation Error Response Format

**User Story:** As an API consumer, I want validation failures to return structured field-level error details, so that I can display precise error messages to end users without additional parsing.

#### Acceptance Criteria

1. WHEN validation fails, THE Validate_Middleware SHALL respond with HTTP status 400.
2. WHEN validation fails, THE Validate_Middleware SHALL respond with a JSON body matching `{ errors: ZodIssue[] }`.
3. WHEN validation fails, each ZodIssue in the `errors` array SHALL contain a `path` array identifying the offending field(s) and a `message` string describing the violation.
4. IF the request body is missing entirely or is not valid JSON, THEN THE Validate_Middleware SHALL respond with HTTP status 400 and a `{ errors: ZodIssue[] }` body.

---

### Requirement 4: OpenAPI Documentation

**User Story:** As an API consumer, I want the OpenAPI specification to document the 400 validation error response shape, so that I can generate accurate client types and understand expected error structures.

1. THE OpenAPI_Spec SHALL define a `ValidationErrorResponse` component schema with a required `errors` array whose items reference a `ZodIssue` schema.
2. THE ZodIssue component schema SHALL include `code` (string), `path` (array of string or number), and `message` (string) as required fields.
3. WHEN a route applies the Validate_Middleware with a body schema, THE OpenAPI_Spec SHALL document a `400` response for that route referencing the `ValidationErrorResponse` component.
4. THE OpenAPI_Spec SHALL define a `ForbiddenError` response component so that routes referencing `#/components/responses/ForbiddenError` resolve correctly.

---

### Requirement 5: Test Coverage

**User Story:** As a developer, I want unit tests for the validate middleware and integration tests on specific routes, so that I can confirm validation behaves correctly for both valid and invalid inputs.

#### Acceptance Criteria

1. THE test suite SHALL include tests for the Validate_Middleware in isolation, covering: valid body passthrough, invalid body rejection, valid params passthrough, and invalid params rejection.
2. WHEN a valid payload is sent to `POST /api/validator/validate`, THE test SHALL assert HTTP 200 and a successful response body.
3. WHEN an invalid payload is sent to `POST /api/validator/validate`, THE test SHALL assert HTTP 400 and a `{ errors: ZodIssue[] }` response body.
4. WHEN a valid payload is sent to `POST /api/comments`, THE test SHALL assert HTTP 201 and a response containing the created comment.
5. WHEN an invalid payload is sent to `POST /api/comments`, THE test SHALL assert HTTP 400 and a `{ errors: ZodIssue[] }` response body.
6. WHEN a valid payload is sent to `PUT /api/comments/:id/vote`, THE test SHALL assert HTTP 200 and a successful response body.
7. WHEN an invalid `type` field is sent to `PUT /api/comments/:id/vote`, THE test SHALL assert HTTP 400 and a `{ errors: ZodIssue[] }` response body.
8. WHEN a valid payload is sent to `POST /api/milestones/submit`, THE test SHALL assert HTTP 201 and a successful response body.
9. WHEN an invalid payload is sent to `POST /api/milestones/submit`, THE test SHALL assert HTTP 400 and a `{ errors: ZodIssue[] }` response body.
