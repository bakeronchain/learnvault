import { Router } from "express"

import { getEvents } from "../controllers/events.controller"

export const eventsRouter = Router()

/**
 * @openapi
 * /api/events:
 *   get:
 *     tags: [Events]
 *     summary: List indexed on-chain events
 *     parameters:
 *       - in: query
 *         name: contract
 *         schema:
 *           type: string
 *         description: Contract ID filter
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Event topic (LearnToken::Mint etc)
 *       - in: query
 *         name: address
 *         schema:
 *           type: string
 *         description: Address in event data
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       contract: { type: string }
 *                       event_type: { type: string }
 *                       data: { type: object }
 *                       ledger_sequence: { type: string }
 *                       created_at: { type: string, format: date-time }
 *       500:
 *         description: Internal error
 */
eventsRouter.get("/events", getEvents)
