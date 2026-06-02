import { Request, Response, NextFunction } from "express";
import multer from "multer";
import sharp from "sharp";
import { Readable } from "stream";
import * as net from "net";

// ---------------------------------------------------------------------------
// Security Constants
// ---------------------------------------------------------------------------
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB Limit

// Blocked mime types specifically excluding executables, scripts, and archives
export const BLOCKED_MIME_TYPES = new Set([
  // Executables
  "application/x-msdownload", // .exe
  "application/x-elf",
  "application/x-sharedlib",
  "application/x-object",
  "application/x-pie-executable",
  // Scripts / HTML
  "text/html",
  "text/javascript",
  "application/javascript",
  "application/x-typescript",
  "application/x-sh",
  "application/x-bash",
  "application/x-python",
  // Archives
  "application/zip",
  "application/x-tar",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/x-gzip",
  "application/x-bzip2",
]);

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// ---------------------------------------------------------------------------
// 1. Native Magic Bytes Validation (Prevents Extension Spoofing)
// ---------------------------------------------------------------------------
export interface MagicBytesResult {
  isValid: boolean;
  detectedMime: string;
}

export function detectMimeTypeFromMagicBytes(buffer: Buffer): MagicBytesResult {
  if (buffer.length < 4) {
    return { isValid: false, detectedMime: "application/octet-stream" };
  }

  // Convert header bytes to hex representation
  const hex = buffer.toString("hex", 0, 12).toUpperCase();

  // Validate common signatures
  if (hex.startsWith("89504E470D0A1A0A")) {
    return { isValid: true, detectedMime: "image/png" };
  }
  if (hex.startsWith("FFD8FF")) {
    return { isValid: true, detectedMime: "image/jpeg" };
  }
  if (hex.startsWith("47494638")) {
    return { isValid: true, detectedMime: "image/gif" };
  }
  if (hex.startsWith("52494646") && hex.slice(16, 24) === "57454250") {
    // RIFF .... WEBP
    return { isValid: true, detectedMime: "image/webp" };
  }
  if (hex.startsWith("25504446")) {
    return { isValid: true, detectedMime: "application/pdf" };
  }

  // Catch zip signatures to explicitly reject archives disguised as other extensions
  if (hex.startsWith("504B0304")) {
    return { isValid: false, detectedMime: "application/zip" };
  }

  return { isValid: false, detectedMime: "application/octet-stream" };
}

// ---------------------------------------------------------------------------
// 2. ClamAV Async Scanner Hook Integration
// ---------------------------------------------------------------------------
export async function scanFileWithClamAV(fileBuffer: Buffer): Promise<{ isSafe: boolean; details: string }> {
  const host = process.env.CLAMAV_HOST || "localhost";
  const port = parseInt(process.env.CLAMAV_PORT || "3310", 10);

  return new Promise((resolve) => {
    // ClamAV daemon protocol: INSTREAM scan
    const client = new net.Socket();
    let responseData = "";

    const timer = setTimeout(() => {
      client.destroy();
      // Safe fallback / logs on failure: in production environments, fail secure
      resolve({ isSafe: false, details: "ClamAV scan timeout exceeded." });
    }, 5000);

    client.connect(port, host, () => {
      // Send INSTREAM command
      client.write("nINSTREAM\n");

      // Format: <length><chunk-data>
      const sizeHeader = Buffer.alloc(4);
      sizeHeader.writeUInt32BE(fileBuffer.length, 0);

      client.write(sizeHeader);
      client.write(fileBuffer);

      // Send 0-length chunk to indicate end of stream
      const zeroHeader = Buffer.alloc(4);
      zeroHeader.writeUInt32BE(0, 0);
      client.write(zeroHeader);
    });

    client.on("data", (data) => {
      responseData += data.toString();
    });

    client.on("end", () => {
      clearTimeout(timer);
      const isClean = responseData.includes("stream: OK") || responseData.includes("OK");
      const isVirus = responseData.includes("FOUND");

      if (isClean && !isVirus) {
        resolve({ isSafe: true, details: "Clean" });
      } else {
        resolve({
          isSafe: false,
          details: responseData.trim() || "ClamAV returned a virus warning or parsing error.",
        });
      }
    });

    client.on("error", (err) => {
      clearTimeout(timer);
      // Log connection error; in production, you can choose to fail-closed or fail-open.
      // Here we implement fail-closed for maximum strict security.
      resolve({
        isSafe: false,
        details: `Failed to communicate with ClamAV daemon: ${err.message}`,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// 3. EXIF/Metadata Stripping using Sharp
// ---------------------------------------------------------------------------
export async function stripImageMetadata(fileBuffer: Buffer, mimeType: string): Promise<Buffer> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    // Return original buffer for non-image types (e.g. PDF) since sharp doesn't process them
    return fileBuffer;
  }

  try {
    // By calling sharp() without keepMetadata or explicitly calling .rotate() (to maintain orientation based on Exif)
    // and not keeping metadata, sharp strips EXIF, profile information, and comments.
    const image = sharp(fileBuffer);
    
    // Convert format dynamically to verify output is standard clean image
    if (mimeType === "image/jpeg") {
      return await image.rotate().jpeg({ quality: 90, force: true }).toBuffer();
    } else if (mimeType === "image/png") {
      return await image.png({ compressionLevel: 8, force: true }).toBuffer();
    } else if (mimeType === "image/webp") {
      return await image.webp({ quality: 85, force: true }).toBuffer();
    } else if (mimeType === "image/gif") {
      return await image.gif({ force: true }).toBuffer();
    }

    return await image.toBuffer();
  } catch (error) {
    throw new Error(`Failed to strip image metadata: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ---------------------------------------------------------------------------
// 4. Multer Configuration (Strict size limits, memory storage only)
// ---------------------------------------------------------------------------
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // Strict 5MB limit
    files: 1, // Enforce single file upload per request
  },
}).single("file");

// ---------------------------------------------------------------------------
// 5. Express Route/Controller Implementation
// ---------------------------------------------------------------------------
export async function handleSecureUploadRoute(req: Request, res: Response): Promise<void> {
  // Use multer middleware inline to catch sizing and validation issues
  uploadMiddleware(req, res, async (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({
            error: "Payload Too Large",
            message: `File exceeds the maximum limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
            code: "FILE_TOO_LARGE",
          });
          return;
        }
        res.status(400).json({
          error: "Bad Request",
          message: `Multer configuration error: ${err.message}`,
          code: "MULTER_ERROR",
        });
        return;
      }
      res.status(500).json({
        error: "Internal Server Error",
        message: "An error occurred during file parsing.",
        code: "UPLOAD_FAILURE",
      });
      return;
    }

    // Verify file exists in request
    if (!req.file) {
      res.status(400).json({
        error: "Bad Request",
        message: "No file was uploaded.",
        code: "MISSING_FILE",
      });
      return;
    }

    const { buffer, originalname } = req.file;

    // A. Perform Server-side MIME validation via magic bytes to reject extension spoofing
    const magicScan = detectMimeTypeFromMagicBytes(buffer);
    
    // Explicitly reject if detected MIME is not allowed, or is blocked
    if (!magicScan.isValid || BLOCKED_MIME_TYPES.has(magicScan.detectedMime)) {
      res.status(415).json({
        error: "Unsupported Media Type",
        message: `The uploaded file format (${magicScan.detectedMime}) is blocked or invalid.`,
        code: "INVALID_FILE_TYPE",
      });
      return;
    }

    // Double check file extension matches magic byte MIME type (prevent spoofing like payload.exe -> payload.png)
    const ext = originalname.split(".").pop()?.toLowerCase();
    const mimeToExtMap: Record<string, string[]> = {
      "image/png": ["png"],
      "image/jpeg": ["jpg", "jpeg"],
      "image/webp": ["webp"],
      "image/gif": ["gif"],
      "application/pdf": ["pdf"],
    };

    const allowedExtensions = mimeToExtMap[magicScan.detectedMime];
    if (!allowedExtensions || !allowedExtensions.includes(ext || "")) {
      res.status(400).json({
        error: "Bad Request",
        message: "File extension does not match the actual file signatures.",
        code: "EXTENSION_MIME_MISMATCH",
      });
      return;
    }

    // B. Run ClamAV Scan Integration (fail-closed secure option)
    const scanResult = await scanFileWithClamAV(buffer);
    if (!scanResult.isSafe) {
      res.status(400).json({
        error: "Bad Request",
        message: `Security Scan Failure: ${scanResult.details}`,
        code: "MALWARE_DETECTED",
      });
      return;
    }

    try {
      // C. Strip EXIF/metadata from images using sharp before IPFS pinning
      const sanitizedBuffer = await stripImageMetadata(buffer, magicScan.detectedMime);

      // Perform simulated IPFS pinning here
      const ipfsHash = `QmFakeHashForVerifiedFileUpload${Date.now()}`;

      // Return structured JSON success response
      res.status(200).json({
        success: true,
        message: "File uploaded, verified, sanitized, and pinned successfully.",
        ipfsHash,
        mimeType: magicScan.detectedMime,
        size: sanitizedBuffer.length,
      });
    } catch (sanitizeError) {
      res.status(400).json({
        error: "Bad Request",
        message: sanitizeError instanceof Error ? sanitizeError.message : "Failed to sanitize image metadata.",
        code: "METADATA_STRIP_FAILED",
      });
    }
  });
}
