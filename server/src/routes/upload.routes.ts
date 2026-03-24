import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";
import {
  pinNftMetadata,
  uploadFile,
} from "../controllers/upload.controller";

export const uploadRouter = Router();

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
uploadRouter.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  uploadFile,
);

/**
 * @openapi
 * /api/upload/nft-metadata:
 *   post:
 *     tags: [Upload]
 *     summary: Pin ScholarNFT JSON metadata to IPFS
 *     description: >
 *       Pins ERC-721-compatible JSON metadata to IPFS. The `image` field must
 *       be a CID already uploaded via POST /api/upload. Returns a `tokenUri`
 *       in ipfs:// format for direct use in the ScholarNFT contract.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description, image]
 *             properties:
 *               name:
 *                 type: string
 *                 example: LearnVault Scholar — Web3 Foundations
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *                 description: CID of the NFT image (from POST /api/upload)
 *               attributes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     trait_type: { type: string }
 *                     value: { type: string }
 *     responses:
 *       201:
 *         description: Metadata pinned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cid:
 *                   type: string
 *                 gatewayUrl:
 *                   type: string
 *                 tokenUri:
 *                   type: string
 *                   example: ipfs://bafybei...
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
uploadRouter.post("/upload/nft-metadata", authMiddleware, pinNftMetadata);
