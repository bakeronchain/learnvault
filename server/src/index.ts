import { createPublicKey } from "node:crypto"
import path from "path"
import cors from "cors"
import dotenv from "dotenv"
import compression from "compression"
import express, { type Request, type Response } from "express"
import helmet from "helmet"
import swaggerUi from "swagger-ui-express"
import YAML from "yaml"
import { z } from "zod"

import { allowedOrigins } from "./config/cors-config"
import { initDb } from "./db/index"
import { createNonceStore } from "./db/nonce-store"
import { createTokenStore } from "./db/token-store"
import { logger } from "./lib/logger"
import { setupConsoleRequestTracing } from "./lib/request-context"
import { initSentry, sentryRequestHandler } from "./lib/sentry"
import { createRequireTrustedOrigin } from "./middleware/csrf.middleware"
import { errorHandler } from "./middleware/error.middleware"
import { globalLimiter } from "./middleware/rate-limit.middleware"
import { requestLogger } from "./middleware/request-logger.middleware"
import { buildOpenApiSpec } from "./openapi"
import { adminMilestonesRouter } from "./routes/admin-milestones.routes"
import { adminRouter } from "./routes/admin.routes"
import { createAuthRouter } from "./routes/auth.routes"
import { createBookmarksRouter } from "./routes/bookmarks.routes"
import { createCommentsRouter } from "./routes/comments.routes"
import { communityRouter } from "./routes/community.routes"
import { coursesRouter } from "./routes/courses.routes"
import { createCredentialsRouter } from "./routes/credentials.routes"
import { donorsRouter } from "./routes/donors.routes"
import { enrollmentsRouter } from "./routes/enrollments.routes"
import { eventsRouter } from "./routes/events.routes"
import { createForumRouter } from "./routes/forum.routes"
import { governanceRouter } from "./routes/governance.routes"
import { healthRouter } from "./routes/health.routes"
import { leaderboardRouter } from "./routes/leaderboard.routes"
import { createMeRouter } from "./routes/me.routes"
import { moderationRouter } from "./routes/moderation.routes"
import { notificationsRouter } from "./routes/notifications.routes"
import { createPeerReviewRouter } from "./routes/peer-review.routes"
import { profilesRouter } from "./routes/profiles.routes"
import { scholarsRouter } from "./routes/scholars.routes"
import { scholarshipsRouter } from "./routes/scholarships.routes"
import { treasuryRouter } from "./routes/treasury.routes"
import { createUploadRouter } from "./routes/upload.routes"
import { createUserProfileRouter } from "./routes/user-profile.routes"
import { validatorRouter } from "./routes/validator.routes"
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
})

const env = envSchema.parse(process.env)

initSentry({
	dsn: process.env.SENTRY_DSN,
	environment: env.NODE_ENV,
	release: process.env.SENTRY_RELEASE || process.env.GIT_COMMIT_HASH,
	tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
	profilesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
})

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
	logger.warn(
		"JWT keys not found in .env — generating ephemeral keys (tokens will reset on restart)",
	)
	const ephemeral = generateEphemeralDevJwtKeys()
	jwtPrivateKey = ephemeral.privateKeyPem
	jwtPublicKey = ephemeral.publicKeyPem
	process.env.JWT_PRIVATE_KEY = jwtPrivateKey
	process.env.JWT_PUBLIC_KEY = jwtPublicKey
}

if (!jwtPrivateKey || !jwtPublicKey) {
	throw new Error(
		"JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be configured to start the server",
	)
}

const publicKeyObject = createPublicKey(
	jwtPublicKey.replace(/\\n/g, "\n").trim(),
)
const keyDetails = publicKeyObject.asymmetricKeyDetails
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

app.use(
	compression({
		filter: (req: Request, res: Response) => {
			const contentType = res.getHeader("Content-Type") as string | undefined
			if (contentType) {
				if (/^image\//i.test(contentType)) return false
				if (/^video\//i.test(contentType)) return false
				if (/^audio\//i.test(contentType)) return false
				if (/application\/octet-stream/i.test(contentType)) return false
			}
			const url = req.url ?? ""
			if (url.includes("/ipfs/") || url.includes("ipfs.io")) return false
			return compression.filter(req, res)
		},
		level: 6,
	}) as any,
)

export { app }

const openApiSpec = buildOpenApiSpec()
const openApiYaml = YAML.stringify(openApiSpec)

app.set("trust proxy", 1)
app.use(requestLogger)
app.use(sentryRequestHandler)
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
				connectSrc: [
					"'self'",
					"https://horizon-testnet.stellar.org",
					"https://horizon.stellar.org",
					"https://ipfs.io",
					"https://*.stellar.org",
				],
				imgSrc: ["'self'", "data:", "https://ipfs.io"],
				upgradeInsecureRequests: [],
			},
		},
		xContentTypeOptions: true,
		hsts: true,
	}),
)
app.use(
	cors({
		origin: (origin, callback) => {
			if (!origin) {
				return callback(null, true)
			}

			if (allowedOrigins.includes(origin)) {
				callback(null, true)
			} else {
				logger.warn({ origin }, "CORS blocked request")
				callback(new Error("Not allowed by CORS"))
			}
		},
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		exposedHeaders: ["X-Request-ID"],
	}),
)
app.use(createRequireTrustedOrigin(allowedOrigins))
app.use(express.json())
app.use(globalLimiter)

app.use("/api", healthRouter)
app.use("/api/auth", createAuthRouter(authService))
app.use("/api", createMeRouter(jwtService, authService))
app.use("/api", coursesRouter)
app.use("/api", createCredentialsRouter(jwtService))
app.use("/api", validatorRouter)
app.use("/api", eventsRouter)
app.use("/api/community", communityRouter)
app.use("/api", createCommentsRouter(jwtService))
app.use("/api", createPeerReviewRouter(jwtService))
app.use("/api", createForumRouter(jwtService))
app.use("/api", leaderboardRouter)
app.use("/api", governanceRouter)
app.use("/api", scholarsRouter)
app.use("/api", adminRouter)
app.use("/api", adminMilestonesRouter)
app.use("/api", moderationRouter)
app.use("/api", createUserProfileRouter(jwtService))
app.use("/api", createUploadRouter(jwtService))
app.use("/api", enrollmentsRouter)
app.use("/api", profilesRouter)
app.use("/api", createBookmarksRouter(jwtService))
app.use("/api", scholarshipsRouter)
app.use("/api", treasuryRouter)
app.use("/api", donorsRouter)
app.use("/api", notificationsRouter)
app.use("/api/wiki", wikiRouter)

if (process.env.NODE_ENV !== "production") {
	void import("./workers/event-poller").then(({ startEventPoller }) => {
		void startEventPoller().catch((err) =>
			logger.error({ err }, "Event poller failed"),
		)
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
	app.use("/api/docs/ui", swaggerUi.serve, swaggerUi.setup(openApiSpec))
}

app.use(errorHandler)

initDb()
	.then(() => {
		app.listen(env.PORT, () => {
			logger.info({ port: env.PORT }, "Server listening")
		})
	})
	.catch((err) => {
		logger.error({ err }, "Failed to initialize database")
		process.exit(1)
	})

process.on("SIGTERM", () => {
	void import("./workers/event-poller").then(({ stopEventPoller }) => {
		void stopEventPoller()
	})
	void import("./workers/escrow-timeout-worker").then(
		({ stopEscrowTimeoutWorker }) => {
			stopEscrowTimeoutWorker()
		},
	)
	process.exit(0)
})
