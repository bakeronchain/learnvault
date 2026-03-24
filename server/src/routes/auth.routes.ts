import { Router } from "express";

import { createAuthControllers } from "../controllers/auth.controller";
import { nonceRateLimiter } from "../middleware/nonce-rate-limit.middleware";
import type { AuthService } from "../services/auth.service";

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();
  const { getNonce, postVerify } = createAuthControllers(authService);

  router.get("/nonce", nonceRateLimiter, (req, res) => {
    void getNonce(req, res);
  });

  router.post("/verify", (req, res) => {
    void postVerify(req, res);
  });

  return router;
}
