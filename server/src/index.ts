import { createPublicKey } from "node:crypto"
import path from "path"
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
import { globalLimiter } from "./middleware/rate-limit.middleware"
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
import { enrollmentsRouter } from "./routes/enrollments.routes"
import { eventsRouter } from "./routes/events.routes"
import { createForumRouter } from "./routes/forum.routes"
import { governanceRouter } from "./routes/governance.routes"
import { healthRouter } from "./routes/health.routes"
import { impactRouter } from "./routes/impact.routes"
import { leaderboardRouter } from "./routes/leaderboard.routes"
import { createMeRouter } from "./routes/me.routes"
import { moderationRouter } from "./routes/moderation.routes"
import { notificationsRouter } from "./routes/notifications.routes"
import { createPeerReviewRouter } from "./routes/peer-review.routes"
import { createScholarsRouter } from "./routes/scholars.routes"
import { scholarshipsRouter } from "./routes/scholarships.routes"
import { sponsorsRouter } from "./routes/sponsors.routes"
import { treasuryRouter } from "./routes/treasury.routes"
import { createUploadRouter } from "./routes/upload.routes"
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
app.use(globalLimiter)

app.use("/api", healthRouter)
app.use("/api/auth", createAuthRouter(authService))
app.use("/api", createMeRouter(jwtService))
app.use("/api", coursesRouter)
app.use("/api", enrollmentsRouter)
app.use("/api", createScholarsRouter(jwtService))
app.use("/api", scholarshipsRouter)
app.use("/api", createForumRouter(jwtService))
app.use("/api", createCredentialsRouter(jwtService))
app.use("/api", validatorRouter)
app.use("/api", eventsRouter)
app.use("/api/community", communityRouter)
app.use("/api", createCommentsRouter(jwtService))
app.use("/api", leaderboardRouter)
app.use("/api", governanceRouter)
app.use("/api", treasuryRouter)
app.use("/api", wikiRouter)
app.use("/api", adminRouter)
app.use("/api", adminMilestonesRouter)
app.use("/api", moderationRouter)
app.use("/api", createUploadRouter(jwtService))
app.use("/api", notificationsRouter)
app.use("/api", createPeerReviewRouter(jwtService))
app.use("/api", donorsRouter)
app.use("/api", sponsorsRouter)
app.use("/api", impactRouter)

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
