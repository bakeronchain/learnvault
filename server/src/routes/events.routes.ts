import { Router } from "express";

import { getEvents } from "../controllers/events.controller";

export const eventsRouter = Router();

/**
 * @openapi
 * /api/events:
 *   get:
 *     tags: [Events]
 *     summary: List platform events
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Optional event type filter
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Max number of events to return
 *     responses:
 *       200:
 *         description: Events fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Event'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
eventsRouter.get("/events", getEvents);
