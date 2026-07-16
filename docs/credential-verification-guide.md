# LearnVault Credential Verification Guide

This guide details how third parties (recruiters, DAOs, external verification
platforms) can cryptographically verify ScholarNFT credentials issued by
LearnVault without needing direct access to the LearnVault database or wallet
connections.

## Verification Protocol

LearnVault signs verification payloads using HMAC-SHA256 with a secure server
key. This ensures the integrity of the data and guarantees it originates from
the official LearnVault server.

### 1. Verification Endpoints

#### Verify a single credential by ID

- **Endpoint**: `GET /api/verify/credentials/:id`
- **Response Payload**:

```json
{
	"valid": true,
	"learner_address": "GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF3UKJQ2K5RQDD",
	"course": {
		"id": "stellar-basics",
		"title": "Introduction to Stellar & Soroban"
	},
	"issued_at": "2026-07-16T20:00:00.000Z",
	"token_id": 1,
	"tx_hash": "a4b7f...",
	"signature": "8a72bdf2..."
}
```

#### List & Verify credentials by Scholar address

- **Endpoint**: `GET /api/verify/address/:address`
- **Response Payload**:

```json
{
	"address": "GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF3UKJQ2K5RQDD",
	"credentials": [
		{
			"valid": true,
			"learner_address": "GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF3UKJQ2K5RQDD",
			"course": {
				"id": "stellar-basics",
				"title": "Introduction to Stellar & Soroban"
			},
			"issued_at": "2026-07-16T20:00:00.000Z",
			"token_id": 1,
			"tx_hash": "a4b7f...",
			"signature": "8a72bdf2..."
		}
	],
	"signature": "2cf34ae9..."
}
```

---

### 2. Validating Signatures

To verify the signature, reconstruct the signing string and compute the
HMAC-SHA256 hash using the shared server secret.

#### Single Credential Signing Format

The signing string is constructed from the fields delimited by colons (`:`):
`[token_id]:[learner_address]:[course_id]:[issued_at]:[valid]`

**Example signing data**:
`1:GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF3UKJQ2K5RQDD:stellar-basics:2026-07-16T20:00:00.000Z:true`

#### Address List Signing Format

The signing string is constructed from the address and sorted list of valid
token IDs: `[address]:[sorted, comma-separated token_ids]`

**Example signing data**:
`GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF3UKJQ2K5RQDD:1,2,5`

---

### 3. JavaScript / Node.js Verification Example

Here is a simple copy-pasteable script to verify the response payload:

```javascript
const crypto = require("crypto")

// The shared secret key configured on the server (CREDENTIAL_SECRET)
const SHARED_SECRET = "your_credential_verification_secret_key"

/**
 * Verifies a single credential payload's signature.
 */
function verifyCredential(payload, secret = SHARED_SECRET) {
	const data = `${payload.token_id}:${payload.learner_address}:${payload.course.id}:${payload.issued_at}:${payload.valid}`

	const expectedSignature = crypto
		.createHmac("sha256", secret)
		.update(data)
		.digest("hex")

	// Use timingSafeEqual to protect against timing attacks
	const expectedBuf = Buffer.from(expectedSignature, "hex")
	const providedBuf = Buffer.from(payload.signature, "hex")

	if (expectedBuf.length !== providedBuf.length) {
		return false
	}
	return crypto.timingSafeEqual(expectedBuf, providedBuf)
}

/**
 * Verifies an address list payload's signature.
 */
function verifyAddressList(payload, secret = SHARED_SECRET) {
	const tokenIds = payload.credentials
		.map((c) => c.token_id)
		.sort((a, b) => a - b)
		.join(",")

	const data = `${payload.address}:${tokenIds}`

	const expectedSignature = crypto
		.createHmac("sha256", secret)
		.update(data)
		.digest("hex")

	const expectedBuf = Buffer.from(expectedSignature, "hex")
	const providedBuf = Buffer.from(payload.signature, "hex")

	if (expectedBuf.length !== providedBuf.length) {
		return false
	}
	return crypto.timingSafeEqual(expectedBuf, providedBuf)
}
```
