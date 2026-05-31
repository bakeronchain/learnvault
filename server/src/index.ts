import { createPublicKey } from "node:crypto"
import path from "path"
import dotenv from "dotenv"

// Load server/.env whether you run from repo root or from server/
dotenv.config({ path: path.resolve(__dirname, "..", ".env") })

// Initialize Sentry FIRST before any other imports that might throw
import { initSentry, sentryRequestHandler } from "./lib/sentry"

initSentry({
	dsn: process.env.SENTRY_DSN,
	environment: process.env.NODE_ENV || "development",
	release: process.env.SENTRY_RELEASE || process.env.GIT_COMMIT_HASH,
	tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
	profilesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
})
import cors from "cors"
import dotenv from "dotenv"
import express from "express"
import helmet from "helmet"
import swaggerUi from "swagger-ui-express"
import { z } from "zod"

import { initDb } from "./db/index"
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
import { adminMilestonesRouter } from "./routes/admin-milestones.routes"
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
import { healthRouter } from "./routes/health.routes"
import { impactRouter } from "./routes/impact.routes"
import { leaderboardRouter } from "./routes/leaderboard.routes"
import { createMeRouter } from "./routes/me.routes"
import { mentorshipRouter } from "./routes/mentorship.routes"
import { moderationRouter } from "./routes/moderation.routes"
import { notificationsRouter } from "./routes/notifications.routes"
import { createPeerReviewRouter } from "./routes/peer-review.routes"
import { createRecommendationsRouter } from "./routes/recommendations.routes"
import { createScholarsRouter } from "./routes/scholars.routes"
import { scholarshipsRouter } from "./routes/scholarships.routes"
import { sponsorsRouter } from "./routes/sponsors.routes"
import { treasuryRouter } from "./routes/treasury.routes"
import { createUploadRouter } from "./routes/upload.routes"
import { createUserProfileRouter } from "./routes/user-profile.routes"
import { validatorRouter } from "./routes/validator.routes"
import { wikiRouter } from "./routes/wiki.routes"
import { createRecommendationsRouter } from "./routes/recommendations.routes"
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
})

const env = envSchema.parse(process.env)
setupConsoleRequestTracing()
const isProduction = env.NODE_ENV === "production"

import { allowedOrigins } from "./config/cors-config"
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
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
				connectSrc: ["'self'", "https://*.stellar.org", "https://ipfs.io"],
				imgSrc: ["'self'", "data:", "https://ipfs.io"],
				upgradeInsecureRequests: [],
			},
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

// API versioning: all routes are served under /api/v1. Legacy /api/* requests
// are 301-redirected to their /api/v1/* equivalent for backwards compatibility.
app.use(apiVersionRedirect)

app.use("/api/v1", healthRouter)
app.use("/api/v1/auth", createAuthRouter(authService, jwtService))
app.use("/api/v1", createMeRouter(jwtService))
app.use("/api/v1", coursesRouter)
app.use("/api/v1", createEnrollmentsRouter(jwtService))
app.use("/api/v1", createScholarsRouter(jwtService))
app.use("/api/v1", scholarshipsRouter)
app.use("/api/v1", mentorshipRouter)
app.use("/api/v1", createRecommendationsRouter(jwtService))
app.use("/api/v1", createForumRouter(jwtService))
app.use("/api/v1", createCredentialsRouter(jwtService))
app.use("/api/v1", validatorRouter)
app.use("/api/v1", eventsRouter)
app.use("/api/v1/community", communityRouter)
app.use("/api/v1", createCommentsRouter(jwtService))
app.use("/api/v1", createPeerReviewRouter(jwtService))
app.use("/api/v1", leaderboardRouter)
app.use("/api/v1", governanceRouter)
app.use("/api/v1", treasuryRouter)
app.use("/api/v1", wikiRouter)
app.use("/api/v1", adminRouter)
app.use("/api/v1", adminMilestonesRouter)
app.use("/api/v1", moderationRouter)
app.use("/api/v1", scholarsRouter)
app.use("/api/v1", createUserProfileRouter(jwtService))
app.use("/api/v1", createUploadRouter(jwtService))
app.use("/api/v1", enrollmentsRouter)
app.use("/api/v1", profilesRouter)
app.use("/api/v1", scholarshipsRouter)
app.use("/api/v1", treasuryRouter)
app.use("/api/v1", notificationsRouter)
app.use("/api/v1/wiki", wikiRouter)

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
