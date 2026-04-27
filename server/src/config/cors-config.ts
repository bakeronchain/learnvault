import { z } from "zod"

const envSchema = z.object({
	CORS_ORIGIN: z.string().default("http://localhost:5173"),
	FRONTEND_URL: z.string().optional(),
	NODE_ENV: z.string().default("development"),
})

const env = envSchema.parse({
	CORS_ORIGIN: process.env.CORS_ORIGIN,
	FRONTEND_URL: process.env.FRONTEND_URL,
	NODE_ENV: process.env.NODE_ENV,
})

const isProduction = env.NODE_ENV === "production"

// Configure allowed CORS origins
export const allowedOrigins = [
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
