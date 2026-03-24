import path from "node:path";

import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import { z } from "zod";

import { createNonceStore } from "./db/nonce-store";
import { errorHandler } from "./middleware/error.middleware";
import { createAuthRouter } from "./routes/auth.routes";
import { healthRouter } from "./routes/health.routes";
import { createMeRouter } from "./routes/me.routes";
import { createAuthService } from "./services/auth.service";
import { createJwtService, generateEphemeralDevJwtKeys } from "./services/jwt.service";

// Load server/.env whether you run from repo root or from server/
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const pemString = z
  .string()
  .min(1)
  .transform((s) => s.replace(/\\n/g, "\n").trim());
import { validatorRouter } from "./routes/validator.routes";
import { commentsRouter } from "./routes/comments.routes";
import { adminMilestonesRouter } from "./routes/admin-milestones.routes";
import { initDb } from "./db/index";


const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  REDIS_URL: z.string().optional(),
  NODE_ENV: z.string().optional(),
  JWT_PRIVATE_KEY: pemString.optional(),
  JWT_PUBLIC_KEY: pemString.optional()
});

const env = envSchema.parse(process.env);

const isProduction = env.NODE_ENV === "production";

let jwtPrivateKey = env.JWT_PRIVATE_KEY;
let jwtPublicKey = env.JWT_PUBLIC_KEY;

if (!jwtPrivateKey || !jwtPublicKey) {
  if (isProduction) {
    throw new Error(
      "JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required in production"
    );
  }
  const pair = generateEphemeralDevJwtKeys();
  jwtPrivateKey = pair.privateKeyPem;
  jwtPublicKey = pair.publicKeyPem;
  console.warn(
    "[learnvault] JWT: using ephemeral RSA keys (dev only). Add JWT_PRIVATE_KEY / JWT_PUBLIC_KEY to server/.env for stable tokens across restarts."
  );
}

const nonceStore = createNonceStore(env.REDIS_URL);
const jwtService = createJwtService(jwtPrivateKey, jwtPublicKey);
const authService = createAuthService(nonceStore, jwtService);

const app = express();
const openApiSpec = buildOpenApiSpec();
const openApiYaml = YAML.stringify(openApiSpec);

app.set("trust proxy", 1);

app.use(morgan("dev"));
app.use(
  cors({
    origin: env.CORS_ORIGIN
  })
);
app.use(express.json());

app.use("/api", healthRouter);
app.use("/api/auth", createAuthRouter(authService));
app.use("/api", createMeRouter(jwtService));
app.use("/api", coursesRouter);
app.use("/api", validatorRouter);
app.use("/api", eventsRouter);
app.use("/api", commentsRouter);
app.use("/api", adminMilestonesRouter);


app.get("/api/docs", (_req, res) => {
  res.type("application/yaml").send(openApiYaml);
});

if (process.env.NODE_ENV !== "production") {
  app.use("/api/docs/ui", swaggerUi.serve, swaggerUi.setup(openApiSpec));
}

app.use(errorHandler);

app.listen(env.PORT, async () => {
  await initDb();
  console.log(`Server listening on port ${env.PORT}`);
});

