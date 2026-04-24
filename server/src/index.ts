import cors from "cors"
import express from "express"
import helmet from "helmet"
import morgan from "morgan"
import { z } from "zod"

import { errorHandler } from "./middleware/error.middleware"
import { communityRouter } from "./routes/community.routes"
import { healthRouter } from "./routes/health.routes"

const envSchema = z.object({
	PORT: z.coerce.number().int().positive().default(4000),
	CORS_ORIGIN: z.string().default("http://localhost:5173"),
})

const env = envSchema.parse(process.env)

const app = express()

app.use(morgan("dev"))
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
		origin: env.CORS_ORIGIN,
	}),
)
app.use(express.json())

app.use("/api", healthRouter)
app.use("/api/community", communityRouter)

app.use(errorHandler)

app.listen(env.PORT, () => {
	console.log(`Server listening on port ${env.PORT}`)
})
