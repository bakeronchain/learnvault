# Admin API Key Rotation

LearnVault now supports runtime admin API key rotation through
`POST /api/admin/rotate-key`.

## Endpoint

`POST /api/admin/rotate-key`

Headers:

- `Authorization: Bearer <admin-jwt>` or `x-api-key: <current-admin-api-key>`
- `Content-Type: application/json`

Body:

```json
{
	"currentKey": "current-admin-api-key"
}
```

Response:

```json
{
	"data": {
		"newKey": "lv_admin_...",
		"rotatedAt": "2026-05-27T12:00:00.000Z",
		"transitionExpiresAt": "2026-05-27T13:00:00.000Z"
	}
}
```

The old key remains valid for one hour after rotation. After the transition
window closes, only the new key is accepted.

## Production Procedure

1. Authenticate as an admin with a JWT or the current API key.
2. Call `POST /api/admin/rotate-key` with the current key in the request body.
3. Store the returned `newKey` in your secret manager immediately. It is only
   returned once.
4. Roll the new secret out to automation, CI/CD, and any internal operators.
5. Verify at least one protected admin endpoint with the new key.
6. Remove the old secret from clients before the one-hour overlap window ends.

## Staleness Alerts

- The backend logs an alert on startup and every 12 hours if the key has not
  been rotated in more than 90 days.
- For the bootstrap environment key, set `ADMIN_API_KEY_LAST_ROTATED_AT` so the
  staleness check can measure age correctly.
- If no rotation date is known, the server treats the key as stale and emits an
  alert.

## Audit Trail

The backend records key rotations and milestone admin actions in
`admin_operation_audit_log`, including:

- actor identity
- auth method (`jwt` or `api_key`)
- request ID
- IP address
- operation outcome

This is designed to feed external log shipping and alerting systems.
