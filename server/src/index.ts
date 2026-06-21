import { createPublicKey } from "node:crypto"
import path from "path"
import cors from "cors"
import dotenv from "dotenv"

// Load server/.env whether you run from repo root or from server/
dotenv.config({ path: path.resolve(__dirname, "..", ".env") })

// Initialize Sentry FIRST before any other imports that might throw
import express from "express"
import helmet from "helmet"
import morgan from "morgan"
import swaggerUi from "swagger-ui-express"
import YAML from "yaml"
import { z } from "zod"
import { allowedOrigins } from "./config/cors-config"
import { initDb } from "./db/index"
import { initSentry, sentryRequestHandler } from "./lib/sentry"

initSentry({
	dsn: process.env.SENTRY_DSN,
	environment: process.env.NODE_ENV || "development",
	release: process.env.SENTRY_RELEASE || process.env.GIT_COMMIT_HASH,
	tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
	profilesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
})

import cors from "cors"

import { createNonceStore } from "./db/nonce-store"
import { createTokenStore } from "./db/token-store"
import { logger } from "./lib/logger"
import { setupConsoleRequestTracing } from "./lib/request-context"
import { createRequireTrustedOrigin } from "./middleware/csrf.middleware"
import { errorHandler } from "./middleware/error.middleware"
import { maybeMountOpenApiValidator } from "./middleware/openapi-validator.middleware"
import { apiVersionRedirect } from "./middleware/api-version.middleware"
import {
	generalLimiter,
	writeLimiter,
} from "./middleware/rate-limit.middleware"
import { requestLogger } from "./middleware/request-logger.middleware"
import { buildOpenApiSpec } from "./openapi"
import { antiSybilRouter } from "./routes/anti-sybil.routes"
import { adminMilestonesRouter } from "./routes/admin-milestones.routes"
import { adminProviderKeysRouter } from "./routes/admin-provider-keys.routes"
import { adminRouter } from "./routes/admin.routes"
import { createAuthRouter } from "./routes/auth.routes"
import { createCommentsRouter } from "./routes/comments.routes"
import { communityRouter } from "./routes/community.routes"
import { coursesRouter } from "./routes/courses.routes"
import { createCredentialsRouter } from "./routes/credentials.routes"
import { donorsRouter } from "./routes/donors.routes"
import { createEnrollmentsRouter } from "./routes/enrollments.routes"
import { eventsRouter } from "./routes/events.routes"
import { governanceRouter } from "./routes/governance.routes"
import { createMilestoneAppealRouter } from "./routes/milestone-appeal.routes"
import { healthRouter } from "./routes/health.routes"
import { impactRouter } from "./routes/impact.routes"
import { leaderboardRouter } from "./routes/leaderboard.routes"
import { lrnRouter } from "./routes/lrn.routes"
import { createMeRouter } from "./routes/me.routes"
import { moderationRouter } from "./routes/moderation.routes"
import { notificationsRouter } from "./routes/notifications.routes"
import { createPeerReviewRouter } from "./routes/peer-review.routes"
import { scholarsRouter } from "./routes/scholars.routes"
import { scholarshipsRouter } from "./routes/scholarships.routes"
import { sponsorsRouter } from "./routes/sponsors.routes"
import { treasuryRouter } from "./routes/treasury.routes"
import { createUploadRouter } from "./routes/upload.routes"
import { createUserProfileRouter } from "./routes/user-profile.routes"
import { validatorRouter } from "./routes/validator.routes"
import { webhooksRouter } from "./routes/webhooks.routes"
import { wikiRouter } from "./routes/wiki.routes"
import { createAuthService } from "./services/auth.service"
import {
	createJwtService,
	generateEphemeralDevJwtKeys,
} from "./services/jwt.service"

dotenv.config({ path: path.resolve(__dirname, "..", ".env") })

const envSchema = z.object({
	PORT: z.coerce.number().int().positive().default(4000),
	CORS_ORIGIN: z.string().default("http://localhost:5173"),
	FRONTEND_URL: z.string().optional(),
	NODE_ENV: z.string().default("development"),
	REDIS_URL: z.string().optional(),
	JWT_PRIVATE_KEY: z.string().optional(),
	JWT_PUBLIC_KEY: z.string().optional(),
	// When "true" the CSP is sent as Content-Security-Policy-Report-Only so
	// violations are logged but not blocked. Enabled automatically in staging
	// (NODE_ENV=staging) and can be forced with CSP_REPORT_ONLY=true.
	CSP_REPORT_ONLY: z.string().optional(),
})

const env = envSchema.parse(process.env)
setupConsoleRequestTracing()
const isProduction = env.NODE_ENV === "production"

let jwtPrivateKey = env.JWT_PRIVATE_KEY
let jwtPublicKey = env.JWT_PUBLIC_KEY

if (!jwtPrivateKey || !jwtPublicKey) {
	if (isProduction) {
		throw new Error(
			"JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables are required in production",
		)
	}
	logger.warn("JWT keys not found in .env - generating ephemeral keys")
	const ephemeral = generateEphemeralDevJwtKeys()
	jwtPrivateKey = ephemeral.privateKeyPem
	jwtPublicKey = ephemeral.publicKeyPem
	process.env.JWT_PRIVATE_KEY = jwtPrivateKey
	process.env.JWT_PUBLIC_KEY = jwtPublicKey
}

const pubKeyObj = createPublicKey(jwtPublicKey.replace(/\\n/g, "\n").trim())
const keyDetails = pubKeyObj.asymmetricKeyDetails
if (!keyDetails?.modulusLength || keyDetails.modulusLength < 2048) {
	throw new Error(
		`JWT RSA key must be at least 2048 bits; found ${keyDetails?.modulusLength ?? "unknown"} bits`,
	)
}

const nonceStore = createNonceStore(env.REDIS_URL)
const tokenStore = createTokenStore(env.REDIS_URL)
const jwtService = createJwtService(jwtPrivateKey, jwtPublicKey, tokenStore)
const authService = createAuthService(nonceStore, jwtService)

const app = express()

app.set("trust proxy", 1)
app.use(requestLogger)
app.use(sentryRequestHandler)
// ---------------------------------------------------------------------------
// Content Security Policy
// ---------------------------------------------------------------------------
// Directives are intentionally explicit (no wildcard *) to maintain a strong
// XSS posture while allowing the Freighter wallet extension, Stellar/Soroban
// RPC endpoints, Sentry error reporting, Google Fonts, and IPFS gateways.
//
// Freighter injects its API via window.freighterApi from a chrome-extension://
// content script — no additional script-src origin is required for that.
// The extension communicates with the host page through window postMessage and
// does NOT load remote scripts from our origin, so script-src stays tight.
//
// Sentry (@sentry/react / @sentry/node) sends events to ingest.sentry.io via
// fetch() — that origin must appear in connect-src.
// ---------------------------------------------------------------------------

const CSP_SENTRY_INGEST = "https://o0.ingest.sentry.io"
// Covers all Sentry ingest sub-accounts (o<id>.ingest.sentry.io).
// Tighten to your exact DSN hostname in production if desired.
const CSP_SENTRY_INGEST_WILDCARD = "https://*.ingest.sentry.io"
const CSP_SENTRY_CDN = "https://browser.sentry-cdn.com"

const isStaging = env.NODE_ENV === "staging"

app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				// Freighter injects via content script — no extra origin needed here.
				// cdn.jsdelivr.net is used by swagger-ui in non-production.
				scriptSrc: [
					"'self'",
					"'unsafe-inline'",
					"https://cdn.jsdelivr.net",
					CSP_SENTRY_CDN,
				],
				// Allowed fetch / XHR / WebSocket destinations:
				//   - self (our own API)
				//   - Stellar Horizon (mainnet + testnet)
				//   - Soroban RPC (testnet + mainnet public)
				//   - IPFS gateways
				//   - Sentry ingest (error reporting)
				//   - Google Fonts metadata (CSS @font-face src)
				connectSrc: [
					"'self'",
					// Stellar Horizon
					"https://horizon-testnet.stellar.org",
					"https://horizon.stellar.org",
					// Soroban RPC
					"https://soroban-testnet.stellar.org",
					"https://rpc-mainnet.stellar.org",
					// Broader *.stellar.org catch-all kept for SDK discovery
					"https://*.stellar.org",
					// IPFS
					"https://ipfs.io",
					"https://gateway.pinata.cloud",
					"https://*.mypinata.cloud",
					// Sentry error reporting
					CSP_SENTRY_INGEST,
					CSP_SENTRY_INGEST_WILDCARD,
					// Google Fonts (font-face descriptors loaded as JSON by some browsers)
					"https://fonts.googleapis.com",
				],
				imgSrc: [
					"'self'",
					"data:",
					"https://ipfs.io",
					"https://gateway.pinata.cloud",
					"https://*.mypinata.cloud",
				],
				// Google Fonts stylesheet
				styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
				// Google Fonts binary font files
				fontSrc: ["'self'", "https://fonts.gstatic.com"],
				// Disallow framing entirely (clickjacking prevention)
				frameAncestors: ["'none'"],
				upgradeInsecureRequests: [],
			},
			// In staging: use Report-Only so violations are logged before the
			// stricter policy ships to production. CSP_REPORT_ONLY=true enables this.
			reportOnly: isStaging || process.env.CSP_REPORT_ONLY === "true",
		},
	}),
)

const allowedOrigins = [
	env.FRONTEND_URL || env.CORS_ORIGIN || "http://localhost:5173",
	"https://learnvault.app",
]
if (!isProduction) {
	allowedOrigins.push(
		"http://localhost:3000",
		"http://localhost:5174",
		"http://127.0.0.1:5173",
	)
}

app.use(
	cors({
		origin: (origin, callback) => {
			if (!origin || allowedOrigins.includes(origin)) callback(null, true)
			else callback(new Error("Not allowed by CORS"))
		},
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
	}),
)

app.use(createRequireTrustedOrigin(allowedOrigins))
app.use(
	"/api/webhooks",
	express.raw({ type: "application/json" }),
	webhooksRouter,
)
app.use(express.json())

// Rate limiting: a general per-IP limit on every request (100 / 15 min), with a
// stricter limit applied to mutation requests (20 / 15 min). 429 responses carry
// a Retry-After header (see rate-limit.middleware.ts).
app.use(generalLimiter)
app.use((req, res, next) => {
	const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
	if (isMutation) {
		writeLimiter(req, res, next)
		return
	}
	next()
})

// Optional request/response validation against docs/openapi.yaml (CI/test only)
void maybeMountOpenApiValidator(app)

app.use("/api", healthRouter)
app.use("/api/auth", createAuthRouter(authService, jwtService))
app.use("/api", createMeRouter(jwtService))
app.use("/api", coursesRouter)
app.use("/api", createEnrollmentsRouter(jwtService))
app.use("/api", createScholarsRouter(jwtService))
app.use("/api", scholarshipsRouter)
app.use("/api", mentorshipRouter)
app.use("/api", createRecommendationsRouter(jwtService))
app.use("/api", createForumRouter(jwtService))
app.use("/api", createCredentialsRouter(jwtService))
app.use("/api", validatorRouter)
app.use("/api", eventsRouter)
app.use("/api/community", communityRouter)
app.use("/api", antiSybilRouter)
app.use("/api", createCommentsRouter(jwtService))
app.use("/api", createPeerReviewRouter(jwtService))
app.use("/api", leaderboardRouter)
app.use("/api", governanceRouter)
app.use("/api", lrnRouter)
app.use("/api", treasuryRouter)
app.use("/api", wikiRouter)
app.use("/api", adminRouter)
app.use("/api", adminMilestonesRouter)
app.use("/api", createMilestoneAppealRouter(jwtService))
app.use("/api", moderationRouter)
app.use("/api", scholarsRouter)
app.use("/api", createUserProfileRouter(jwtService))
app.use("/api", createUploadRouter(jwtService))
app.use("/api", enrollmentsRouter)
app.use("/api", createReviewsRouter(jwtService))
app.use("/api", scholarshipsRouter)
app.use("/api", treasuryRouter)
app.use("/api", notificationsRouter)
app.use("/api/wiki", wikiRouter)

// Start event poller (non-prod only for now)
if (process.env.NODE_ENV !== "production") {
	void import("./workers/event-poller").then(({ startEventPoller }) => {
		void startEventPoller().catch(console.error)
	})
}

if (process.env.NODE_ENV !== "test") {
	void import("./workers/escrow-timeout-worker").then(
		({ startEscrowTimeoutWorker }) => {
			void startEscrowTimeoutWorker().catch(console.error)
		},
	)
}

app.get("/api/docs", (_req, res) => {
	res.type("application/yaml").send(openApiYaml)
})

if (!isProduction) {
	const openApiSpec = buildOpenApiSpec()
	app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec))
}

app.use(errorHandler)

async function start() {
	if (process.env.SKIP_DB !== "true") {
		await initDb()
	}

	app.listen(env.PORT, () => {
		logger.info({ port: env.PORT }, "Server listening")
	})

	if (process.env.NODE_ENV !== "production") {
		void import("./workers/event-poller").then(({ startEventPoller }) => {
			void startEventPoller().catch((err) =>
				logger.error({ err }, "Event poller failed"),
			)
		})
	}
}

void start()
