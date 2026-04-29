import { Router } from "express"

import {
	getUserProfile,
	upsertUserProfile,
	deleteUserProfile,
} from "../controllers/user-profile.controller"
import { createRequireAuth } from "../middleware/auth.middleware"
import { type JwtService } from "../services/jwt.service"

export function createUserProfileRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	/**
	 * @openapi
	 * /api/profile/{address}:
	 *   get:
	 *     tags: [Profile]
	 *     summary: Get user profile
	 *     description: Returns a user's rich profile including bio, avatar, social links, and stats.
	 *     parameters:
	 *       - in: path
	 *         name: address
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: User's Stellar wallet address
	 *     responses:
	 *       200:
	 *         description: User profile with stats
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 profile:
	 *                   $ref: '#/components/schemas/UserProfile'
	 *                 stats:
	 *                   $ref: '#/components/schemas/ProfileStats'
	 *                 milestones:
	 *                   type: object
	 *                   properties:
	 *                     completed:
	 *                       type: integer
	 *                     pending:
	 *                       type: integer
	 *                 credentials:
	 *                   type: array
	 *                   items:
	 *                     type: object
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.get("/profile/:address", (req, res) => {
		void getUserProfile(req, res)
	})

	/**
	 * @openapi
	 * /api/profile:
	 *   put:
	 *     tags: [Profile]
	 *     summary: Update user profile
	 *     description: Updates or creates the authenticated user's profile. Requires authentication.
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               displayName:
	 *                 type: string
	 *                 maxLength: 100
	 *                 nullable: true
	 *               bio:
	 *                 type: string
	 *                 maxLength: 1000
	 *                 nullable: true
	 *               avatarUrl:
	 *                 type: string
	 *                 maxLength: 500
	 *                 nullable: true
	 *               avatarCid:
	 *                 type: string
	 *                 maxLength: 100
	 *                 nullable: true
	 *               socialLinks:
	 *                 type: object
	 *                 properties:
	 *                   twitter:
	 *                     type: string
	 *                     maxLength: 200
	 *                   github:
	 *                     type: string
	 *                     maxLength: 200
	 *                   linkedin:
	 *                     type: string
	 *                     maxLength: 200
	 *                   website:
	 *                     type: string
	 *                     maxLength: 200
	 *                   discord:
	 *                     type: string
	 *                     maxLength: 200
	 *     responses:
	 *       200:
	 *         description: Profile updated successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 profile:
	 *                   $ref: '#/components/schemas/UserProfile'
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.put("/profile", requireAuth, (req, res) => {
		void upsertUserProfile(req, res)
	})

	/**
	 * @openapi
	 * /api/profile:
	 *   delete:
	 *     tags: [Profile]
	 *     summary: Delete user profile
	 *     description: Deletes the authenticated user's profile. Requires authentication.
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Profile deleted successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.delete("/profile", requireAuth, (req, res) => {
		void deleteUserProfile(req, res)
	})

	return router
}
