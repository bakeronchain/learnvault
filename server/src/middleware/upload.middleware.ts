import multer from "multer";
import { AppError } from "../errors/app-error-handler";

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/pdf",
  "video/mp4",
] as const;

type AllowedMimeType = (typeof ALLOWED_TYPES)[number];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (!ALLOWED_TYPES.includes(file.mimetype as AllowedMimeType)) {
    return cb(
      new AppError("Invalid file type", 400, {
        file: `${file.mimetype} is not allowed. Accepted: PNG, JPEG, PDF, MP4`,
      }),
    );
  }
  cb(null, true);
};

// Files are kept in memory so the controller can pass the buffer directly to
// Pinata without writing anything to disk.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});
