import cors from "cors"
import express from "express"
import morgan from "morgan"
import swaggerUi from "swagger-ui-express"
import YAML from "yaml"
import { z } from "zod"

import { errorHandler } from "./middleware/error.middleware"
import { buildOpenApiSpec } from "./openapi"
import { coursesRouter } from "./routes/courses.routes"
import { eventsRouter } from "./routes/events.routes"
import { healthRouter } from "./routes/health.routes"
import { validatorRouter } from "./routes/validator.routes"

const envSchema = z.object({
	PORT: z.coerce.number().int().positive().default(4000),
	CORS_ORIGIN: z.string().default("http://localhost:5173"),
})

const env = envSchema.parse(process.env)

const app = express()
const openApiSpec = buildOpenApiSpec()
const openApiYaml = YAML.stringify(openApiSpec)

app.use(morgan("dev"))
app.use(
	cors({
		origin: env.CORS_ORIGIN,
	}),
)
app.use(express.json())

app.use("/api", healthRouter)
app.use("/api", coursesRouter)
app.use("/api", validatorRouter)
app.use("/api", eventsRouter)

app.get("/api/docs", (_req, res) => {
	res.type("application/yaml").send(openApiYaml)
})

if (process.env.NODE_ENV !== "production") {
	app.use("/api/docs/ui", swaggerUi.serve, swaggerUi.setup(openApiSpec))
}

app.use(errorHandler)

app.listen(env.PORT, () => {
	console.log(`Server listening on port ${env.PORT}`)
})
