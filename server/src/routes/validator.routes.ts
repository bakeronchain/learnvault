import { Router } from "express";
import { validateMilestone } from "../controllers/validator.controller";
import * as schemas from "../lib/zod-schemas";
import { validate } from "../middleware/validation.middleware";

export const validatorRouter = Router();

/**
 * @openapi
 * /api/validator/validate:
 *   post:
 *     tags: [Validator]
 *     summary: Validate a learner milestone
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ValidatorRequest'
 *     responses:
 *       200:
 *         description: Milestone validation successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/ValidatorResult'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
validatorRouter.post(
  "/validator/validate", 
  validate({
    body: schemas.validateMilestoneSchema
  }),
  validateMilestone
);
