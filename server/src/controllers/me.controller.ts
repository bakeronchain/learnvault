import type { Request, Response } from "express";

export function getMe(req: Request, res: Response): void {
  const address = req.walletAddress;
  if (!address) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.status(200).json({
    address
  });
}
