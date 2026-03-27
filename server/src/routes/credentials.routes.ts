import { Router } from "express"

import { createCredentialMetadata } from "../controllers/credentials.controller"
import * as schemas from "../lib/zod-schemas"
import { validate } from "../middleware/validation.middleware"

export const credentialsRouter = Router()

/**
 * @openapi
 * /api/credentials/metadata:
 *   post:
 *     tags: [Credentials]
 *     summary: Generate and upload NFT metadata for a course completion credential
 *     description: |
 *       Creates ERC-721/ERC-1155 compliant metadata for a ScholarNFT credential,
 *       uploads it to IPFS via Pinata, and returns the ipfs:// URI for use in
 *       scholar_nft.mint().
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - course_id
 *               - learner_address
 *               - completed_at
 *             properties:
 *               course_id:
 *                 type: string
 *                 description: Course identifier (e.g., "stellar-basics")
 *                 example: "stellar-basics"
 *               learner_address:
 *                 type: string
 *                 description: Stellar address of the learner
 *                 example: "GABC123...XYZ789"
 *               completed_at:
 *                 type: string
 *                 format: date-time
 *                 description: ISO 8601 timestamp of course completion
 *                 example: "2026-03-26T10:30:00Z"
 *     responses:
 *       201:
 *         description: Metadata created and uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     metadata_uri:
 *                       type: string
 *                       description: IPFS URI for use in scholar_nft.mint()
 *                       example: "ipfs://bafkreiabcdef1234567890ghijklmnopqrstuvwxyz"
 *                     gateway_url:
 *                       type: string
 *                       description: HTTP gateway URL for viewing metadata
 *                       example: "https://gateway.pinata.cloud/ipfs/bafkreiabcdef1234567890ghijklmnopqrstuvwxyz"
 *                     metadata:
 *                       type: object
 *                       description: The generated metadata object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "Introduction to Stellar & Soroban — Course Completion"
 *                         description:
 *                           type: string
 *                           example: "Issued to learners who complete all milestones in Introduction to Stellar & Soroban"
 *                         image:
 *                           type: string
 *                           example: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
 *                         attributes:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               trait_type:
 *                                 type: string
 *                               value:
 *                                 type: string
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Course not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Course not found"
 *                 message:
 *                   type: string
 *                   example: "No course found with id: invalid-course"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *       503:
 *         description: IPFS pinning service not configured
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Service unavailable"
 *                 message:
 *                   type: string
 *                   example: "IPFS pinning service is not configured. Please contact the administrator."
 */
credentialsRouter.post(
	"/credentials/metadata",
	validate({
		body: schemas.createCredentialMetadataBodySchema,
	}),
	createCredentialMetadata,
)
