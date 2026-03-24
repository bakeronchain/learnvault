import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error-handler";
import {
  getGatewayUrl,
  pinFileToIPFS,
  pinJsonToIPFS,
} from "../services/pinata.service";

// ---------------------------------------------------------------------------
// POST /api/upload
// ---------------------------------------------------------------------------

/**
 * Pin a file to IPFS via Pinata and return the CID + gateway URL.
 * The file is expected as multipart/form-data under the field name "file".
 */
export async function uploadFile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError("No file provided", 400, {
        file: 'A file is required under the field name "file"',
      });
    }

    const cid = await pinFileToIPFS(req.file.buffer, req.file.originalname);
    const gatewayUrl = getGatewayUrl(cid);

    res.status(201).json({ cid, gatewayUrl });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/upload/nft-metadata
// ---------------------------------------------------------------------------

const nftMetadataSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().min(1, "description is required"),
  // CID of the image already pinned via POST /api/upload
  image: z.string().min(1, "image CID is required"),
  attributes: z
    .array(
      z.object({
        trait_type: z.string(),
        value: z.union([z.string(), z.number()]),
      }),
    )
    .optional(),
});

/**
 * Pin ScholarNFT JSON metadata to IPFS.
 * The image must already be uploaded via POST /api/upload.
 * Returns the metadata CID and an ipfs:// URI suitable for the NFT contract's
 * tokenURI / baseURI.
 */
export async function pinNftMetadata(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = nftMetadataSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        "Invalid metadata",
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    const { name, description, image, attributes } = parsed.data;

    // Normalise image to an ipfs:// URI so the metadata is self-contained
    const imageUri = image.startsWith("ipfs://") ? image : `ipfs://${image}`;

    const metadata: Record<string, unknown> = {
      name,
      description,
      image: imageUri,
      ...(attributes ? { attributes } : {}),
    };

    const cid = await pinJsonToIPFS(metadata, `${name}-metadata.json`);
    const gatewayUrl = getGatewayUrl(cid);

    res.status(201).json({
      cid,
      gatewayUrl,
      // ipfs:// URI for use directly in the ScholarNFT contract
      tokenUri: `ipfs://${cid}`,
    });
  } catch (err) {
    next(err);
  }
}
