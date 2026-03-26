import path from "path"
import cors from "cors"
import dotenv from "dotenv"
import express from "express"
import morgan from "morgan"
import swaggerUi from "swagger-ui-express"
import YAML from "yaml"
import { z } from "zod"

import { initDb } from "./db/index"
import { createNonceStore } from "./db/nonce-store"
import { errorHandler } from "./middleware/error.middleware"
import { globalLimiter } from "./middleware/rate-limit.middleware"
import { buildOpenApiSpec } from "./openapi"
import { adminMilestonesRouter } from "./routes/admin-milestones.routes"
import { adminRouter } from "./routes/admin.routes"
import { createAuthRouter } from "./routes/auth.routes"
import { commentsRouter } from "./routes/comments.routes"
import { coursesRouter } from "./routes/courses.routes"
import { credentialsRouter } from "./routes/credentials.routes"
import { enrollmentsRouter } from "./routes/enrollments.routes"
import { eventsRouter } from "./routes/events.routes"
import { governanceRouter } from "./routes/governance.routes"
import { healthRouter } from "./routes/health.routes"
import { leaderboardRouter } from "./routes/leaderboard.routes"
import { createMeRouter } from "./routes/me.routes"
import { scholarsRouter } from "./routes/scholars.routes"
import { scholarshipsRouter } from "./routes/scholarships.routes"
import { uploadRouter } from "./routes/upload.routes"
import { validatorRouter } from "./routes/validator.routes"
import { createAuthService } from "./services/auth.service"
import {
	createJwtService,
	generateEphemeralDevJwtKeys,
} from "./services/jwt.service"

// Load server/.env whether you run from repo root or from server/
dotenv.config({ path: path.resolve(__dirname, "..", ".env") })

const pemString = z
	.string()
	.min(1)
	.transform((s) => s.replace(/\\n/g, "\n").trim())

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

const isProduction = env.NODE_ENV === "production"

// Configure allowed CORS origins
const allowedOrigins = [
	env.FRONTEND_URL || env.CORS_ORIGIN || "http://localhost:5173",
	"https://learnvault.app",
	"https://www.learnvault.app",
]

// In development, also allow common local dev ports
if (!isProduction) {
	allowedOrigins.push(
		"http://localhost:5173",
		"http://localhost:3000",
		"http://localhost:5174",
		"http://127.0.0.1:5173",
	)
}

let jwtPrivateKey = env.JWT_PRIVATE_KEY
let jwtPublicKey = env.JWT_PUBLIC_KEY

// Generate ephemeral keys in dev if not provided
if (!isProduction && (!jwtPrivateKey || !jwtPublicKey)) {
	console.warn(
		"⚠️  JWT keys not found in .env — generating ephemeral keys (tokens will reset on restart)",
	)
	const ephemeral = generateEphemeralDevJwtKeys()
	jwtPrivateKey = ephemeral.privateKeyPem
	jwtPublicKey = ephemeral.publicKeyPem
}

const nonceStore = createNonceStore(env.REDIS_URL)
const jwtService = createJwtService(jwtPrivateKey, jwtPublicKey)
const authService = createAuthService(nonceStore, jwtService)

const app = express()
const openApiSpec = buildOpenApiSpec()
const openApiYaml = YAML.stringify(openApiSpec)

app.set("trust proxy", 1)
app.use(morgan("dev"))
app.use(
	cors({
		origin: (origin, callback) => {
			// Allow requests with no origin (like mobile apps, Postman, curl)
			if (!origin) {
				return callback(null, true)
			}

			if (allowedOrigins.includes(origin)) {
				callback(null, true)
			} else {
				console.warn(`CORS blocked request from origin: ${origin}`)
				callback(new Error("Not allowed by CORS"))
			}
		},
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
	}),
)
app.use(express.json())
app.use(globalLimiter)

// Routes
app.use("/api", healthRouter)
app.use("/api/auth", createAuthRouter(authService))
app.use("/api", createMeRouter(jwtService))
app.use("/api", coursesRouter)
app.use("/api", credentialsRouter)
app.use("/api", validatorRouter)
app.use("/api", eventsRouter)
app.use("/api", commentsRouter)
app.use("/api", leaderboardRouter)
app.use("/api", governanceRouter)
app.use("/api", scholarsRouter)
app.use("/api", adminRouter)
app.use("/api", adminMilestonesRouter)
app.use("/api", scholarsRouter)
app.use("/api", uploadRouter)
app.use("/api", enrollmentsRouter)
app.use("/api", scholarshipsRouter)

// Start event poller (non-prod only for now)
if (process.env.NODE_ENV !== "production") {
	void import("./workers/event-poller.js").then(({ startEventPoller }) => {
		void startEventPoller().catch(console.error)
	})
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
			console.log(`Server listening on port ${env.PORT}`)
		})
	})
	.catch((err) => {
		console.error("Failed to initialize database:", err)
		process.exit(1)
	})

// Graceful shutdown
process.on("SIGTERM", () => {
	void import("./workers/event-poller.js").then(({ stopEventPoller }) => {
		void stopEventPoller()
	})
	process.exit(0)
})
