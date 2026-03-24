import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const ADMIN_ADDRESSES = (process.env.ADMIN_ADDRESSES ?? "")
  .split(",")
  .map((a) => a.trim())
  .filter(Boolean);

const JWT_SECRET = process.env.JWT_SECRET || "learnvault-secret";

export interface AdminRequest extends Request {
  adminAddress?: string;
}

/**
 * Middleware that verifies the Bearer JWT and checks the wallet address
 * is in the ADMIN_ADDRESSES allowlist.
 *
 * In dev mode (no ADMIN_ADDRESSES set) any valid JWT is accepted so the
 * API remains usable without extra config.
 */
export function requireAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  let decoded: { address?: string; sub?: string };

  try {
    decoded = jwt.verify(token, JWT_SECRET) as { address?: string; sub?: string };
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const address = decoded.address ?? decoded.sub ?? "";
  if (!address) {
    res.status(401).json({ error: "Token missing address claim" });
    return;
  }

  // If ADMIN_ADDRESSES is configured, enforce the allowlist
  if (ADMIN_ADDRESSES.length > 0 && !ADMIN_ADDRESSES.includes(address)) {
    res.status(403).json({ error: "Forbidden: not an admin address" });
    return;
  }

  req.adminAddress = address;
  next();
}
