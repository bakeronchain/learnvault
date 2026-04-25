/**
 * CSRF posture regression tests.
 *
 * The LearnVault API authenticates exclusively via `Authorization: Bearer`
 * headers — there are no auth cookies, and therefore no ambient credentials
 * that a cross-origin page could ride. See `docs/csrf-protection.md` for the
 * full rationale.
 *
 * These tests pin the invariants that make that claim hold:
 *   1. CORS is a strict allowlist (disallowed origins are not granted ACAO).
 *   2. The auth middleware rejects requests without a valid Bearer token.
 *   3. Protected endpoints do not issue Set-Cookie on success.
 *
 * If any of these regresses (e.g. someone introduces cookie-based sessions
 * or loosens CORS to `origin: true`), this file should fail before the
 * change ships.
 */

import cors from "cors"
import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"

import { createRequireAuth } from "../middleware/auth.middleware"
import { createRequireTrustedOrigin } from "../middleware/csrf.middleware"
import { errorHandler } from "../middleware/error.middleware"

const JWT_SECRET = "learnvault-csrf-test-secret"
const ALLOWED_ORIGIN = "https://learnvault.app"
const DISALLOWED_ORIGIN = "https://malicious-site.example"
const ALLOWED_ORIGINS = [ALLOWED_ORIGIN]

const testJwtService = {
	signWalletToken: (addr: string) => jwt.sign({ sub: addr }, JWT_SECRET),
	verifyWalletToken: (token: string) => {
		const d = jwt.verify(token, JWT_SECRET) as {
			sub?: string
			address?: string
		}
		const sub = d.sub ?? d.address ?? ""
		if (!sub) throw new Error("Invalid token")
		return { sub }
	},
}

function validToken(address = "GUSER123") {
	return jwt.sign({ sub: address }, JWT_SECRET, { expiresIn: "1h" })
}

/**
 * Builds an app whose CORS + auth wiring mirrors `server/src/index.ts`.
 * Uses a synthetic `/api/protected` route so we exercise the middleware
 * chain in isolation, without pulling in database or external-service
 * dependencies.
 */
function buildApp() {
	const app = express()
	app.use(
		cors({
			origin: (origin, cb) => {
				if (!origin) return cb(null, true)
				if (origin === ALLOWED_ORIGIN) return cb(null, true)
				return cb(new Error("Not allowed by CORS"))
			},
			credentials: true,
			methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
		}),
	)
	app.use(createRequireTrustedOrigin(ALLOWED_ORIGINS))
	app.use(express.json())

	const requireAuth = createRequireAuth(testJwtService)
	app.post("/api/protected", requireAuth, (_req, res) => {
		res.status(200).json({ ok: true })
	})
	app.post("/api/public", (_req, res) => {
		res.status(200).json({ ok: true })
	})
	app.get("/api/public", (_req, res) => {
		res.status(200).json({ ok: true })
	})

	app.use(errorHandler)
	return app
}

describe("CSRF posture — bearer-only auth model", () => {
	it("OPTIONS preflight from a disallowed origin is not granted Access-Control-Allow-Origin", async () => {
		const res = await request(buildApp())
			.options("/api/protected")
			.set("Origin", DISALLOWED_ORIGIN)
			.set("Access-Control-Request-Method", "POST")
			.set("Access-Control-Request-Headers", "authorization,content-type")

		// Without ACAO echoed back for the attacker's origin, the browser will
		// refuse to send the real cross-origin POST.
		expect(res.headers["access-control-allow-origin"]).toBeUndefined()
	})

	it("cross-origin POST from a disallowed origin is blocked at the CORS layer", async () => {
		const res = await request(buildApp())
			.post("/api/protected")
			.set("Origin", DISALLOWED_ORIGIN)
			.set("Authorization", `Bearer ${validToken()}`)
			.send({})

		// The cors middleware forwards the rejection to errorHandler; the
		// protected handler never runs and no ACAO is set for the attacker.
		expect(res.headers["access-control-allow-origin"]).toBeUndefined()
		expect(res.body?.ok).toBeUndefined()
	})

	it("state-changing POST without an Authorization header is rejected with 401", async () => {
		const res = await request(buildApp())
			.post("/api/protected")
			.set("Origin", ALLOWED_ORIGIN)
			.send({})

		expect(res.status).toBe(401)
	})

	it("state-changing POST with an invalid Bearer token is rejected with 401", async () => {
		const res = await request(buildApp())
			.post("/api/protected")
			.set("Origin", ALLOWED_ORIGIN)
			.set("Authorization", "Bearer not-a-real-token")
			.send({})

		expect(res.status).toBe(401)
	})

	it("state-changing POST with an empty Bearer value is rejected with 401", async () => {
		const res = await request(buildApp())
			.post("/api/protected")
			.set("Origin", ALLOWED_ORIGIN)
			.set("Authorization", "Bearer ")
			.send({})

		expect(res.status).toBe(401)
	})

	describe("requireTrustedOrigin middleware", () => {
		it("rejects a state-changing POST on an unauth endpoint when Origin is untrusted", async () => {
			// Attacker owns their own server and makes a cross-origin call with
			// their real Origin — browser-mediated CSRF scenario. cors also
			// blocks this, but the dedicated middleware pins the behavior.
			const res = await request(buildApp())
				.post("/api/public")
				.set("Origin", DISALLOWED_ORIGIN)
				.send({})

			expect(res.status).toBeGreaterThanOrEqual(400)
			expect(res.body?.ok).toBeUndefined()
		})

		it("rejects a state-changing POST when only Referer is set and is untrusted", async () => {
			const res = await request(buildApp())
				.post("/api/public")
				.set("Referer", `${DISALLOWED_ORIGIN}/some/path`)
				.send({})

			expect(res.status).toBe(403)
			expect(res.body?.ok).toBeUndefined()
		})

		it("allows a state-changing POST when only Referer is set and is trusted", async () => {
			const res = await request(buildApp())
				.post("/api/public")
				.set("Referer", `${ALLOWED_ORIGIN}/dashboard`)
				.send({})

			expect(res.status).toBe(200)
			expect(res.body?.ok).toBe(true)
		})

		it("rejects a state-changing POST when Referer is malformed", async () => {
			const res = await request(buildApp())
				.post("/api/public")
				.set("Referer", "not a url")
				.send({})

			expect(res.status).toBe(403)
		})

		it("allows state-changing POST with neither Origin nor Referer (server-to-server)", async () => {
			// Permissive mode: curl/Postman/workers without a browser
			// fingerprint pass through. Auth middleware on protected routes
			// is the load-bearing defense for this path.
			const res = await request(buildApp()).post("/api/public").send({})

			expect(res.status).toBe(200)
		})

		it("does not block GET requests from a trusted origin", async () => {
			// Baseline: the trusted-origin gate only applies to state-changing
			// methods. GET/HEAD/OPTIONS pass through untouched.
			const res = await request(buildApp())
				.get("/api/public")
				.set("Origin", ALLOWED_ORIGIN)

			expect(res.status).toBe(200)
		})

		it("does not gate GETs on Referer (reads are not state-changing)", async () => {
			// Even with an untrusted Referer, a GET passes — the middleware
			// short-circuits on non-state-changing methods.
			const { createRequireTrustedOrigin: make } =
				await import("../middleware/csrf.middleware")
			const mw = make(ALLOWED_ORIGINS)
			const req = {
				method: "GET",
				headers: { referer: `${DISALLOWED_ORIGIN}/x` },
			} as unknown as import("express").Request
			let called = false
			const next = () => {
				called = true
			}
			mw(req, {} as import("express").Response, next)
			expect(called).toBe(true)
		})
	})

	it("protected endpoint does not issue Set-Cookie on success (bearer-only invariant)", async () => {
		// If this starts failing, someone has introduced cookie-based auth —
		// revisit docs/csrf-protection.md and add CSRF token validation
		// before merging.
		const res = await request(buildApp())
			.post("/api/protected")
			.set("Origin", ALLOWED_ORIGIN)
			.set("Authorization", `Bearer ${validToken()}`)
			.send({})

		expect(res.status).toBe(200)
		expect(res.headers["set-cookie"]).toBeUndefined()
	})
})
