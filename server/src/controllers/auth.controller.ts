import type { Request, Response } from "express";

import type { AuthService } from "../services/auth.service";

export function createAuthControllers(authService: AuthService) {
  return {
    async getNonce(req: Request, res: Response): Promise<void> {
      const address =
        typeof req.query.address === "string" ? req.query.address.trim() : "";

      if (!address) {
        res.status(400).json({ error: "Missing query parameter: address" });
        return;
      }

      try {
        const { nonce } = await authService.getOrCreateNonce(address);
        res.status(200).json({ nonce });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Bad request";
        if (message === "Invalid Stellar public key") {
          res.status(400).json({ error: message });
          return;
        }
        res.status(400).json({ error: message });
      }
    },

    async postVerify(req: Request, res: Response): Promise<void> {
      const body = req.body as { address?: unknown; signature?: unknown };
      const address =
        typeof body.address === "string" ? body.address.trim() : "";
      const signature =
        typeof body.signature === "string" ? body.signature.trim() : "";

      if (!address || !signature) {
        res
          .status(400)
          .json({ error: "Missing required fields: address, signature" });
        return;
      }

      try {
        const token = await authService.verifyAndIssueToken(address, signature);
        res.status(200).json({
          token,
          tokenType: "Bearer",
          expiresIn: "24h"
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unauthorized";
        if (
          message === "Invalid Stellar public key" ||
          message === "Invalid signature encoding"
        ) {
          res.status(400).json({ error: message });
          return;
        }
        if (message === "Invalid signature") {
          res.status(401).json({ error: message });
          return;
        }
        if (message.startsWith("Nonce expired")) {
          res.status(401).json({ error: message });
          return;
        }
        res.status(401).json({ error: message });
      }
    }
  };
}
