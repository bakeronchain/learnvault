import { Router } from "express";

import { getMe } from "../controllers/me.controller";
import { createRequireAuth } from "../middleware/auth.middleware";
import type { JwtService } from "../services/jwt.service";

export function createMeRouter(jwtService: JwtService): Router {
  const router = Router();
  const requireAuth = createRequireAuth(jwtService);

  router.get("/me", requireAuth, getMe);

  return router;
}
