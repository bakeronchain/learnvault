# OpenAPI validation in CI

LearnVault generates its OpenAPI spec from route JSDoc annotations and validates
it in CI to prevent spec drift.

## Generated spec

- Source: route annotations under `server/src/routes/*.ts`
- Output: `docs/openapi.yaml`
- Command: `npm run docs:generate --prefix server`

## CI checks

CI runs the following (from `server/`):

- `npm run openapi:lint`
  - Regenerates the spec and lints `../docs/openapi.yaml` using `@redocly/cli`
- `npm run openapi:check`
  - Runs `openapi:lint` and then fails if `docs/openapi.yaml` changed (drift)

If `openapi:check` fails, re-run spec generation locally and commit the updated
`docs/openapi.yaml`:

```bash
npm run docs:generate --prefix server
git add docs/openapi.yaml
git commit -m "docs: regenerate OpenAPI spec"
```

## Runtime request/response validation (optional)

For CI/test-only validation against the generated spec, set:

- `OPENAPI_VALIDATE=true`

This enables `express-openapi-validator` middleware at runtime (see
`server/src/middleware/openapi-validator.middleware.ts`).

