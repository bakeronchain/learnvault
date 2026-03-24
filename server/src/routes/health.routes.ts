import { Router } from "express"

import { getHealth } from "../controllers/health.controller"

export const healthRouter = Router()

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Check server health status
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
healthRouter.get("/health", getHealth)
