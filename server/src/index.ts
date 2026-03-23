import cors from "cors";
import express from "express";
import morgan from "morgan";
import { z } from "zod";

import { errorHandler } from "./middleware/error.middleware";
import { healthRouter } from "./routes/health.routes";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173")
});

const env = envSchema.parse(process.env);

const app = express();

app.use(morgan("dev"));
app.use(
  cors({
    origin: env.CORS_ORIGIN
  })
);
app.use(express.json());

app.use("/api", healthRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Server listening on port ${env.PORT}`);
});
