import { Router } from "express"
import { pinNftMetadata, uploadFile } from "../controllers/upload.controller"
import { createRequireAuth } from "../middleware/auth.middleware"
import { upload } from "../middleware/upload.middleware"
import { type JwtService } from "../services/jwt.service"

export function createUploadRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	/**
	 * @openapi
	 * /api/upload:
	 *   post:
	 *     tags: [Upload]
	 *     summary: Pin a file to IPFS via Pinata
	 *     description: >
	 *       Accepts a single file (PDF, PNG, JPEG, MP4 — max 10 MB), pins it to
	 *       IPFS via Pinata, and returns the CID and a Pinata gateway URL.
	 *       Use this endpoint to upload proposal attachments, course cover images,
	 *       and ScholarNFT images before referencing their CIDs elsewhere.
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         multipart/form-data:
	 *           schema:
	 *             type: object
	 *             required: [file]
	 *             properties:
	 *               file:
	 *                 type: string
	 *                 format: binary
	 *     responses:
	 *       201:
	 *         description: File pinned successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 cid:
	 *                   type: string
	 *                   example: bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi
	 *                 gatewayUrl:
	 *                   type: string
	 *                   example: https://gateway.pinata.cloud/ipfs/bafybei...
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 */
	router.post("/upload", requireAuth, upload.single("file"), uploadFile)

	/**
	 * Pin NFT metadata (JSON) to IPFS
	 * @openapi
	 * /api/upload/nft-metadata:
	 *   post:
	 *     tags: [Upload]
	 *     summary: Pin NFT metadata to IPFS
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       201:
	 *         description: Metadata pinned successfully
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 */
	router.post("/upload/nft-metadata", requireAuth, pinNftMetadata)

	return router
}
