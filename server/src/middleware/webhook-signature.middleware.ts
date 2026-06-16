import { createHmac, timingSafeEqual } from "node:crypto"
import { type NextFunction, type Request, type Response } from "express"

const SIGNATURE_HEADER = "x-webhook-signature"

function parseSignatureHeader(header: string): string | null {
	const trimmed = header.trim()
	if (!trimmed) return null
	if (trimmed.startsWith("sha256=")) {
		return trimmed.slice("sha256=".length)
	}
	return trimmed
}

function safeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) return false
	try {
		return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"))
	} catch {
		return false
	}
}

/**
 * Verifies HMAC-SHA256 signatures on webhook payloads.
 * Expects the raw request body (Buffer) and header `X-Webhook-Signature: sha256=<hex>`.
 */
export function verifyWebhookSignature(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	const secret = process.env.WEBHOOK_SECRET
	if (!secret) {
		res.status(503).json({ error: "Webhook secret not configured" })
		return
	}

	const header = req.headers[SIGNATURE_HEADER]
	if (typeof header !== "string") {
		res.status(401).json({ error: "Missing webhook signature" })
		return
	}

	const provided = parseSignatureHeader(header)
	if (!provided || !/^[0-9a-f]+$/i.test(provided)) {
		res.status(401).json({ error: "Invalid webhook signature" })
		return
	}

	const rawBody = req.body
	if (!Buffer.isBuffer(rawBody)) {
		res.status(400).json({ error: "Invalid request body" })
		return
	}

	const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
	if (!safeEqualHex(expected, provided)) {
		res.status(401).json({ error: "Invalid webhook signature" })
		return
	}

	next()
}
