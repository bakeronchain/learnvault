import { Router } from "express"
import { getProfile, updateProfile } from "../controllers/profiles.controller"
import { authMiddleware } from "../middleware/auth.middleware"

export const profilesRouter = Router()

/**
 * @openapi
 * /api/profiles/{address}:
 *   get:
 *     tags: [Profiles]
 *     summary: Get user profile
 *     description: Returns the public profile for a specific wallet address.
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet address
 *     responses:
 *       200:
 *         description: User profile
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Internal server error
 */
profilesRouter.get("/profiles/:address", (req, res) => {
	void getProfile(req, res)
})

/**
 * @openapi
 * /api/profiles/me:
 *   put:
 *     tags: [Profiles]
 *     summary: Update or create user profile
 *     description: Upserts the profile for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_name:
 *                 type: string
 *               bio:
 *                 type: string
 *               avatar_url:
 *                 type: string
 *               twitter:
 *                 type: string
 *               github:
 *                 type: string
 *               website:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated profile
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Display name already taken
 *       500:
 *         description: Internal server error
 */
profilesRouter.put("/profiles/me", authMiddleware, (req, res) => {
	void updateProfile(req, res)
})
